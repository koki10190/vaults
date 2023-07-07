import dotenv from "dotenv";
dotenv.config();

const database_guild = "1123623839037919304";
const database_channel = "1123624150225920060";
import express from "express";
import multer from "multer";
import bcrypt, { hash } from "bcrypt";
import fs from "fs";
import mongoose from "mongoose";
import { rateLimit } from "express-rate-limit";
import jwt from "jsonwebtoken";
import client from "./discord/bot";
import cors from "cors";
import uuid from "uuid4";
// MongoDB Models
import User from "./models/User";
import UserType from "./interfaces/UserType";
import GetUserByEmail from "./searches/GetUserByEmail";
import GetUserByHandle from "./searches/GetUserByHandle";
import { TextChannel } from "discord.js";
import sanitize from "sanitize-html";
import http from "http";
import { marked } from "marked";
import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import Post from "./models/Post";
import uuid4 from "uuid4";
import usernameOrEmailTaken from "./functions/usernameOrEmailTaken";
import { fetchGlobalPosts, fetchPostsFollowing, fetchUserPosts } from "./functions/fetchPosts";
import { Socket, Server as ioServer } from "socket.io";
import { initSocket } from "./io/socket";
import smtpTransport from "nodemailer-smtp-transport";

const transporter = nodemailer.createTransport(
	smtpTransport({
		service: "smtp.gmail.com",
		secure: false,
		port: 465,
		auth: {
			user: "beezle.app.lol@gmail.com",
			pass: process.env.GMAIL_PASS as string,
		},
	})
);

function sendEmail(to: string, subject: string, text: string) {
	const mailOptions = {
		from: process.env.GMAIL_ACCOUNT,
		to,
		subject,
		text,
	};
	transporter.sendMail(mailOptions as Mail.Options, (err, info) => {
		if (err) return console.log(err);
	});
}

const limiter = rateLimit({
	windowMs: 30 * 1000, // 15 minutes
	max: 50, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const upload = multer({ dest: "uploads" });

mongoose.connect(process.env.MONGO_URI as string).then(() =>
	console.log("[BEEZLE] Connected to the Mongoose Database")
);

const app = express();
const server = http.createServer(app);
const io = initSocket(server);
server.listen(process.env.PORT, () =>
	console.log("[BEEZLE] Listening to port " + process.env.PORT)
);
// app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
	cors({
		origin: "*",
	})
);

app.get("/", (req: express.Request, res: express.Response) => {
	res.send("Hello, World!");
	Post.deleteMany({
		__v: { $gte: 0 },
	}).then(() => res.write("Deleted!"));

	User.findOneAndUpdate(
		{
			handle: "koki2",
		},
		{
			following: [],
		}
	);
});

app.get("/deletgae", (req: express.Request, res: express.Response) => {
	User.deleteMany({
		__v: { $gte: 0 },
	}).then(() => res.write("Deleted!"));
});

app.post("/api/register-user", async (req: express.Request, res: express.Response) => {
	const { name, email, password } = req.body;
	const salt = await bcrypt.genSalt(10);
	const hashed = await bcrypt.hash(password, salt);

	if (await usernameOrEmailTaken(name, email)) {
		res.json({
			error:
				"The username " +
				name +
				" or email " +
				email +
				" is already taken!",
			was_error: true,
		});
		return;
	}

	if (!email.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g)) {
		res.json({
			error: "Invalid email address!",
			was_error: true,
		});
		return;
	}

	if (!name.match(/^[a-z0-9\._-]+$/g)) {
		res.json({
			error: "The username cannot have any special characters except of dots, dashes and underscores!",
			was_error: true,
		});
		return;
	}

	const user = await User.create({
		handle: name,
		displayName: name,
		email: email,
		password: hashed,
	});

	const token = jwt.sign(user.toJSON(), process.env.TOKEN_SECRET as string);
	// sendEmail(
	// 	email,
	// 	"Thank you for registering on Beezle!",
	// 	`Thank you for registering on Beezle, ${name}!\n\nYou can use your account to post, discover accounts, follow accounts and much more!.`
	// );

	res.json({ token, error: "", was_error: false });
});

app.post("/api/login", async (req: express.Request, res: express.Response) => {
	const { email, password } = req.body;
	const user = (await GetUserByEmail(email)) || (await GetUserByHandle(email));

	if (!user) {
		return res.json({
			error: "Incorrect email address!",
			was_error: true,
		});
	}

	if (!(await bcrypt.compare(password, user.password))) {
		return res.json({
			error: "Incorrect password!",
			was_error: true,
		});
	}

	const token = jwt.sign(user.toJSON(), process.env.TOKEN_SECRET as string);
	return res.json({ token, error: "", was_error: false });
});

app.post("/api/verify-token", async (req: express.Request, res: express.Response) => {
	const { token } = req.body;
	jwt.verify(
		token,
		process.env.TOKEN_SECRET as string,
		async (err: any, user: any) => {
			if (err) return res.json({ error: true });

			const m_user = await User.findOne({
				email: user.email,
				handle: user.handle,
			});

			res.json({ user: m_user, error: false });
		}
	);
});

app.post("/api/get-user", async (req: express.Request, res: express.Response) => {
	const { handle } = req.body;

	const user = await GetUserByHandle(handle);
	if (!user) return res.json({ error: "Couldn't find user!", was_error: true });
	const userData = user!.toJSON() as any;
	delete userData["password"];
	return res.json({ user: userData, was_error: false, error: "" });
});

app.post("/api/upload-avatar", upload.single("avatar"), async (req, res) => {
	let path = req.file?.path;
	const { token } = req.body;

	jwt.verify(
		token,
		process.env.TOKEN_SECRET as string,
		async (err: any, user: any) => {
			if (err) return res.json({ error: true });

			res.json({ user, error: false });
			console.log(path);

			fs.rename(
				path!,
				path! + "." + (req.body.ext as string),
				err => {
					if (err)
						console.log(
							err
						);
				}
			);
			path = path! + "." + (req.body.ext as string);

			const guild = await client.guilds.fetch(
				database_guild
			);
			const channel = (await guild.channels.fetch(
				database_channel
			)) as TextChannel;
			const message = await channel.send({
				files: [{ attachment: path! }],
			});

			const attachment =
				message.attachments.first()?.proxyURL;
			console.log(attachment);

			const m_user = await User.updateOne(
				{
					email: user.email,
					handle: user.handle,
				},
				{
					avatar: attachment,
				}
			);

			fs.unlink(path, err => {
				if (err) console.log(err);
			});
		}
	);
});

app.post("/api/upload-banner", upload.single("banner"), async (req, res) => {
	let path = req.file?.path;
	const { token } = req.body;

	jwt.verify(
		token,
		process.env.TOKEN_SECRET as string,
		async (err: any, user: any) => {
			if (err) return res.json({ error: true });

			res.json({ user, error: false });
			console.log(path);

			fs.rename(
				path!,
				path! +
					"." +
					(req.body
						.ext_banner as string),
				err => {
					if (err)
						console.log(
							err
						);
				}
			);
			path = path! + "." + (req.body.ext_banner as string);

			const guild = await client.guilds.fetch(
				database_guild
			);
			const channel = (await guild.channels.fetch(
				database_channel
			)) as TextChannel;
			const message = await channel.send({
				files: [{ attachment: path! }],
			});

			const attachment =
				message.attachments.first()?.proxyURL;
			console.log(attachment);

			const m_user = await User.updateOne(
				{
					email: user.email,
					handle: user.handle,
				},
				{
					banner: attachment,
				}
			);

			fs.unlink(path, err => {
				if (err) console.log(err);
			});
		}
	);
});

app.post("/api/edit-profile", (req: express.Request, res: express.Response) => {
	const { displayName, token, bio } = req.body;
	const m_bio = sanitize(marked(bio), {
		allowedTags: ["img"],
	});

	console.log(req.body);
	jwt.verify(
		token,
		process.env.TOKEN_SECRET as string,
		async (err: any, user: any) => {
			console.log(err);
			if (err) return res.json({ error: true });
			const m_user = await User.updateOne(
				{
					email: user.email,
					handle: user.handle,
				},
				{
					displayName,
					bio: m_bio,
				}
			);

			res.send({ error: false });
		}
	);
});

app.get("/verify/:handle", async (req: express.Request, res: express.Response) => {
	const { handle } = req.params;

	const user = await User.updateOne(
		{
			handle,
		},
		{
			moderator: true,
		}
	);

	res.send("test!");
});

app.post("/api/post", async (req: express.Request, res: express.Response) => {
	const { content, token } = req.body;

	if (content === "") return;

	jwt.verify(
		token,
		process.env.TOKEN_SECRET as string,
		async (err: any, user: any) => {
			if (err) return res.json({ error: true });

			const m_user = await User.findOne({
				email: user.email,
				handle: user.handle,
			});

			const post = await Post.create({
				postID: uuid4(),
				content,
				op: m_user?.handle,
			});

			const box_type = {
				op: await User.findOne({
					handle: post.op,
				}),
				data: post,
			};

			io.emit("post", box_type);
			res.json(box_type);
		}
	);
});

app.get("/api/explore-posts/:offset", async (req: express.Request, res: express.Response) => {
	const { offset } = req.params;
	const posts = await fetchGlobalPosts(parseInt(offset));
	return res.json({
		posts: posts.data,
		latestIndex: posts.latestIndex,
	});
});

app.get("/api/user-posts/:handle", async (req: express.Request, res: express.Response) => {
	const { handle } = req.params;

	return res.json({
		posts: fetchUserPosts(handle as string),
	});
});

app.post("/api/follow-posts", async (req: express.Request, res: express.Response) => {
	const { token } = req.body;

	jwt.verify(
		token,
		process.env.TOKEN_SECRET as string,
		async (err: any, user: any) => {
			const m_user = (await User.findOne({
				email: user.email,
				handle: user.handle,
			}))!;

			return res.json({
				posts: fetchPostsFollowing(
					m_user.following as string[]
				),
			});
		}
	);
});

app.post("/api/like-post", async (req: express.Request, res: express.Response) => {
	const { token, postId, unlike } = req.body;

	jwt.verify(
		token,
		process.env.TOKEN_SECRET as string,
		async (err: any, user: any) => {
			const m_user = (await User.findOne({
				email: user.email,
				handle: user.handle,
			}))!;
			const Unlike = async () => {
				const post =
					await Post.findOneAndUpdate(
						{
							postID: postId,
						},
						{
							$pull: {
								likes: m_user.handle,
							},
						}
					);
				if (!post)
					return res.json({
						error: true,
					});

				const index = m_post?.likes.findIndex(
					x => x === user.handle
				);
				if (index! < 0) return;
				m_post?.likes.splice(index!, 1);

				io.emit(
					"post-like-refresh",
					postId,
					m_post?.likes
				);
			};

			const m_post = await Post.findOne({ postID: postId });
			if (m_post?.likes.find(x => x === user.handle))
				return Unlike();

			if (unlike) {
				Unlike();
			} else {
				const post =
					await Post.findOneAndUpdate(
						{
							postID: postId,
						},
						{
							$push: {
								likes: m_user.handle,
							},
						}
					);
				if (!post)
					return res.json({
						error: true,
					});
				m_post?.likes.push(m_user.handle);
			}

			res.json({ error: false });
			io.emit("post-like-refresh", postId, m_post?.likes);
		}
	);
});

app.get("/api/get-user-posts/:handle", async (req: express.Request, res: express.Response) => {
	const { handle } = req.params;
	const posts = await Post.find({ op: handle });
	res.json(posts);
});

app.post("/api/follow", async (req: express.Request, res: express.Response) => {
	const { token, toFollow, unfollow } = req.body;

	jwt.verify(
		token,
		process.env.TOKEN_SECRET as string,
		async (err: any, user: any) => {
			if (toFollow == user.handle) return;
			const Unfollow = async () => {
				const m_user =
					await User.findOneAndUpdate(
						{
							email: user.email,
							handle: user.handle,
						},
						{
							$pull: {
								following: toFollow,
							},
						}
					);

				const m_user_follow =
					await User.findOneAndUpdate(
						{
							handle: toFollow,
						},
						{
							$pull: {
								followers: user.handle,
							},
						}
					);
			};

			const m_user = await User.findOneAndUpdate(
				{
					email: user.email,
					handle: user.handle,
				},
				{
					$push: {
						following: toFollow,
					},
				}
			);
			const userToFollow = await User.findOne({
				handle: toFollow,
			});

			if (
				userToFollow?.followers.find(
					x => x == user.handle
				)
			) {
				Unfollow();
			}

			if (!unfollow) {
				const m_user_follow =
					await User.findOneAndUpdate(
						{
							handle: toFollow,
						},
						{
							$push: {
								followers: user.handle,
							},
						}
					);
			} else {
				Unfollow();
			}
		}
	);
	res.json({ followed: true });
});

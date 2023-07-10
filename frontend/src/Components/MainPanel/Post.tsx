import { useEffect, useRef, useState, UIEvent } from "react";
import "./Post.css";
import UserType from "../../interfaces/UserType";
import GetUserData from "../../api/GetUserData";
import PostBox from "./PostBox";
import EmojiPicker, { EmojiClickData, EmojiStyle, Theme } from "emoji-picker-react";
import VerifyBadge from "../../functions/VerifyBadge";
import CutLong from "../../functions/CutLong";
import axios from "axios";
import { PostBoxType } from "../../interfaces/PostType";
import socket from "../../io/socket";
import { api_url } from "../../constants/ApiURL";
import getBadgeType from "../../functions/getBadgeType";
import { Icons, toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

function Post({ fetch_method }: { fetch_method: string }) {
	const navigate = useNavigate();
	let user: UserType;
	const [meUser, setMe] = useState<UserType>();
	const avatar = useRef<HTMLDivElement>(null);
	const username = useRef<HTMLParagraphElement>(null);
	const handle = useRef<HTMLParagraphElement>(null);
	const post = useRef<HTMLTextAreaElement>(null);
	const postFile = useRef<HTMLInputElement>(null);
	const emojiPicker = useRef<HTMLDivElement>(null);

	const [isEmojiPickerShown, setEmojiShown] = useState(false);
	const [posts, setPosts] = useState([] as PostBoxType[]);
	const [showPosts, setShowPosts] = useState(false);
	const [postsOffset, setPostsOffset] = useState(0);

	let postCheck = 0;
	// socket.on("post", async (post: PostBoxType) => {
	// 	if (postCheck > 0) {
	// 		if (postCheck >= 4) postCheck = 0;
	// 	}
	// 	if (post.data.reply_type) return;
	// 	if (posts.find(x => x.data.postID == post.data.postID)) return;
	// 	posts.unshift(post);
	// 	setPosts([...posts]);
	// 	postCheck++;
	// });

	let postDeleteCheck = 0;
	socket.on("post-deleted", async (postId: string, isrepost: boolean) => {
		if (postDeleteCheck > 0) {
			if (postDeleteCheck >= 4) postDeleteCheck = 0;
		}
		if (isrepost) return;
		posts.splice(
			posts.findIndex(x => x.data.postID == postId),
			1
		);
		setPosts([...posts]);
		postDeleteCheck++;
	});

	let postLikesCheck = 0;
	socket.on("post-like-refresh", async (postId: string, liked: string[]) => {
		if (postLikesCheck > 0) {
			if (postLikesCheck >= 4) postLikesCheck = 0;
		}
		const post = posts.findIndex(m_post => m_post.data.postID == postId);
		if (post < 0) return;
		posts[post].data.likes = liked;
		setPosts([...posts]);
		postLikesCheck++;
	});

	let postRepostCheck = 0;
	socket.on("post-repost-refresh", async (postId: string, reposts: string[]) => {
		if (postRepostCheck > 0) {
			if (postRepostCheck >= 4) postRepostCheck = 0;
		}
		const post = posts.findIndex(m_post => m_post.data.postID == postId);
		if (post < 0) return;
		posts[post].data.reposts = reposts;
		setPosts([...posts]);
		postRepostCheck++;
	});

	useEffect(() => {
		(async () => {
			user = (await GetUserData()).user;
			setMe(user);
			console.log("hm");
			setShowPosts(true);
			localStorage.setItem("notifs", JSON.stringify(user.notifications));
			localStorage.setItem("handle", user.handle);
			window.dispatchEvent(new Event("update-notif-counter"));

			avatar.current!.style.backgroundImage = `url("${user.avatar}")`;
			username.current!.innerText = user.displayName;
			handle.current!.innerText = "@" + user.handle;

			post.current!.innerText = "";

			VerifyBadge(username.current!, user);
			CutLong(user.displayName, 10);

			axios.get(`${api_url}/api/${fetch_method}/${postsOffset}`).then(async res => {
				setPosts(res.data.posts as PostBoxType[]);

				setPostsOffset(res.data.latestIndex);
			});
		})();

		postFile.current!.addEventListener("change", async (event: Event) => {
			const fileFormData = new FormData();
			console.log(postFile.current!.files![0]);
			fileFormData.append("file", postFile.current!.files![0]);

			const split = postFile.current!.files![0].name.split(".");
			const ext = split[split.length - 1];
			fileFormData.append("ext", ext);

			fileFormData.append("token", localStorage.getItem("auth_token") as string);

			alert("The file is being uploaded, please wait.");

			const res = (
				await axios.post(`${api_url}/api/upload-file`, fileFormData, {
					headers: {
						"Content-Type": "multipart/form-data",
					},
				})
			).data;

			post.current!.value += " " + res.img;
		});
	}, []);

	const redirectToUserProfile = () => {
		console.log(user);
		navigate("/profile/" + localStorage.getItem("handle"));
	};

	const addEmoji = (emoji: EmojiClickData) => {
		post.current!.value += emoji.emoji;
	};

	const showEmojiPicker = () => setEmojiShown(!isEmojiPickerShown);

	const [limiter, setLimiter] = useState(false);

	const makePost = () => {
		if (limiter) return;
		if (post.current!.value == "") return;
		setLimiter(true);

		setTimeout(() => setLimiter(false), 5000);

		axios.post(`${api_url}/api/post`, {
			token: localStorage.getItem("auth_token")!,
			content: post.current!.value,
			socketID: socket.id,
		}).then(res => {
			if (res.data.error) return;
			posts.unshift(res.data);
			setPosts([...posts]);
			post.current!.value = "";
		});
	};

	const detectScrolling = (event: UIEvent<HTMLDivElement>) => {
		const element = event.target! as HTMLDivElement;
		if (element.scrollHeight - element.scrollTop === element.clientHeight) {
			axios.get(`${api_url}/api/${fetch_method}/${postsOffset + 1}`).then(async res => {
				// let found = false;
				// for (const reply of res.data
				// 	.posts as PostBoxType[]) {
				// 	console.log(
				// 		reply.data
				// 			.content
				// 	);
				// 	if (
				// 		posts.findIndex(
				// 			x =>
				// 				x
				// 					.data
				// 					.postID ===
				// 				reply
				// 					.data
				// 					.postID
				// 		) > -1
				// 	) {
				// 		found =
				// 			true;
				// 		break;
				// 	}
				// }
				// if (found) return;
				setPosts(posts.concat(res.data.posts as PostBoxType[]));

				setPostsOffset(res.data.latestIndex);
				console.log(`Offset: ${res.data.latestIndex}`);
			});
		}
	};

	const uploadImage = async () => {
		postFile.current!.click();
	};

	const refresh = async () => {
		const tst = toast("Refreshing posts", {
			icon: Icons.spinner,
			progressStyle: {
				backgroundColor: "yellow",
			},
			theme: "dark",
			hideProgressBar: true,
		});
		axios.get(`${api_url}/api/${fetch_method}/0`).then(async res => {
			setPosts(res.data.posts as PostBoxType[]);
			setPostsOffset(res.data.latestIndex);
			toast("Refreshed the posts", {
				icon: Icons.success,
				progressStyle: {
					backgroundColor: "yellow",
				},
				theme: "dark",
			});
			toast.dismiss(tst);
		});
	};

	return (
		<>
			{/* <div className="image-shower"></div> */}

			<div
				className="navigation-panel main-panel make-post"
				onScroll={detectScrolling}
			>
				<p
					onClick={refresh}
					className="refresh"
				>
					<i className="fa-solid fa-arrows-rotate"></i> Refresh Posts
				</p>
				<div
					onClick={redirectToUserProfile}
					className="post-text-user"
				>
					<div
						ref={avatar}
						className="post-text-avatar"
					></div>
					<p
						ref={username}
						className="post-text-name"
					>
						Name
					</p>
					<p
						ref={handle}
						className="post-text-handle"
					>
						@handle
					</p>
				</div>
				<div className="post-text-box">
					<textarea
						ref={post}
						placeholder="Press here to type your post."
						className="post-textarea"
					></textarea>
					<div className="post-text-buttons">
						<a onClick={showEmojiPicker}>
							<i className="fa-solid fa-face-awesome"></i>
						</a>
						<a onClick={uploadImage}>
							<i className="fa-solid fa-image"></i>
						</a>
						<input
							accept=".gif,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,.mp3,.ogg,.wav"
							style={{
								display: "none",
							}}
							type="file"
							ref={postFile}
						/>
						<button onClick={makePost}>Post</button>
					</div>
					{isEmojiPickerShown ? (
						<div
							className="emoji-picker-post"
							ref={emojiPicker}
						>
							<EmojiPicker
								onEmojiClick={addEmoji}
								theme={Theme.DARK}
								emojiStyle={EmojiStyle.TWITTER}
							/>
						</div>
					) : (
						<div></div>
					)}
				</div>
				<hr
					style={{
						boxSizing: "content-box",
					}}
					className="small-bar"
				/>
				{showPosts
					? posts.map(item =>
							!item.data.repost_type ? (
								<PostBox
									edited={item.data.edited}
									repost_type={
										item.data
											.repost_type
									}
									repost_id={
										item.data
											.repost_id
									}
									repost_op={
										item.data
											.repost_op
									}
									badgeType={getBadgeType(
										item.op
									)}
									reply_type={
										item.data
											.reply_type
									}
									replyingTo={
										item.data
											.replyingTo
									}
									key={item.data.postID}
									date={item.data.date}
									postId={item.data.postID}
									name={item.op.displayName}
									handle={item.op.handle}
									avatarURL={item.op.avatar}
									content={item.data.content}
									likes={item.data.likes}
									reposts={item.data.reposts}
									replies={item.data.replies}
									tokenUser={meUser!}
								/>
							) : (
								""
							)
					  )
					: ""}
			</div>
		</>
	);
}

export default Post;

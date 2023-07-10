import { useEffect, useRef } from "react";
import GetUserData from "../api/GetUserData";
import NavigationPanel from "../Components/NavigationPanel";
import InfoPanel from "../Components/InfoPanel";
import Bookmarks from "../Components/MainPanel/Bookmarks";
import { useNavigate } from "react-router-dom";

function HomeBookmarks() {
	let user;

	(async () => {
		user = await GetUserData();
		if (user.error) {
			const navigate = useNavigate();
			navigate("/");
		}
	})();
	return (
		<>
			<div className="main-pages">
				<InfoPanel />
				<Bookmarks />
				<NavigationPanel />
			</div>
		</>
	);
}

export default HomeBookmarks;

import UserType from "../interfaces/UserType";

function VerifyBadge(element: HTMLElement, user: UserType) {
	element.textContent = user.displayName;

	if (user.owner)
		element.innerHTML += ` <i style="color: lime" class="fa-solid fa-gear-complex-code"></i>`;
	else if (user.moderator)
		element.innerHTML += ` <i style="color: yellow" class="fa-solid fa-shield-check"></i>`;
	else if (user.verified)
		element.innerHTML += ` <i style="color: yellow" class="fa-solid fa-badge-check"></i>`;
}

export default VerifyBadge;

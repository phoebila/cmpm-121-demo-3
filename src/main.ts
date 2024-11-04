// todo
const APP_NAME = "Demo 3 121";
const app = document.querySelector<HTMLDivElement>("#app")!;

document.title = APP_NAME;

const heading = document.createElement("h1");
heading.textContent = APP_NAME;

const fakeButton = document.createElement("button");
fakeButton.textContent = "Click me!";
fakeButton.onclick = () => alert("You clicked me!");

app.append(fakeButton);

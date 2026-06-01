/** @type {import('tailwindcss').Config} */
export default {
	darkMode: "class",
	content: ["./src/mainview/**/*.{html,js,ts,jsx,tsx}"],
	theme: {
		extend: {
			colors: {
				apple: {
					blue: {
						light: "#007AFF",
						dark: "#0A84FF",
					},
					bg: {
						light: "#F5F5F7",
						dark: "#1E1E1E",
					},
					sidebar: {
						light: "#ECECEC",
						dark: "#252526",
					},
					border: {
						light: "rgba(0, 0, 0, 0.08)",
						dark: "rgba(255, 255, 255, 0.06)",
					},
					gray: {
						light: "#8E8E93",
						dark: "#AEAEB2",
					}
				}
			}
		},
	},
	plugins: [],
};

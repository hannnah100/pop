import { createRoot } from "react-dom/client";
import App from "./App";
import { initNativePlatform } from "./lib/native";
import "./index.css";

void initNativePlatform();

createRoot(document.getElementById("root")!).render(<App />);

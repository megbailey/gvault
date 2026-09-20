/// <reference path="./types/index.d.ts" />
import React from "react";
import ReactDOM from "react-dom/client";
import DriveOverlay from "./components/DriveOverlay";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
    throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(<DriveOverlay />);

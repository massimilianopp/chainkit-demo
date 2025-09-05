import { Buffer } from "buffer";
if (!window.Buffer) window.Buffer = Buffer;

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import WalletLayer from "./WalletLayer.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <WalletLayer>
    <App />
  </WalletLayer>
);


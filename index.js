const express = require("express");
const morgan = require("morgan");
const { createProxyMiddleware } = require("http-proxy-middleware");
require('dotenv').config()

const app = express();

const PORT = 3000;
const HOST = "localhost";

app.use(morgan("dev"));

app.use(
    "/",
    createProxyMiddleware({
        target: "https://www.google.com",
        changeOrigin: true,
        pathRewrite: {
            "^/": "",
        },
    })
);

// Starting our Proxy server
app.listen(PORT, HOST, () => {
    console.log(`Starting Proxy at ${HOST}:${PORT}`);
});

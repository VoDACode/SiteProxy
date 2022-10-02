const express = require("express");
const configDynamic = require('config-dynamic');
const { tcpPingPort } = require('tcp-ping-port');
const { createProxyMiddleware } = require("http-proxy-middleware");
const path = require('path');
const mainApp = express();
const errorProxy = express();

let config = configDynamic.util.loadFileConfigs(path.join(__dirname, "config"));

let servers = new Map();
checkServersStatus();

setInterval(checkServersStatus, 5000);

mainApp.use(
    "/",
    createProxyMiddleware({
        changeOrigin: true,
        ws: true,
        router: async function (req) {
            const host = req.hostname;
            const routers = config.routers;

            if (!routers || !Array.isArray(routers))
                throw new Error('Incorrect config parameter "routers"');

            const item = routers.find(p => p.from == host);
            if (!item || servers.size == 0) {
                req.headers["code"] = 404;
                return `http://${host}:${config.ProxyErrorsServerPort}/`;
            }

            if (servers.size > 0 && servers.has(item.from) && !servers.get(item.from)) {
                req.headers["code"] = 500;
                return `http://${host}:${config.ProxyErrorsServerPort}/`;
            }

            return item.to;
        }
    })
);

if (config.api.isEnabled) {
    errorProxy.get("/_api/proxy-list", (req, res) => {
        if (req.query.apiKey != "" && req.query.apiKey != config.api.key) {
            res.statusCode = 401;
            res.end();
            return;
        }
        let results = [];
        for (let server of servers) {
            results.push({ host: server[0], status: server[1] });
        }
        res.json(results);
    });
}

errorProxy.get("/", (req, res) => {
    if (req.headers["code"] == '404')
        res.sendFile(path.join(__dirname, '404.html'));
    else if (req.headers["code"] == '500')
        res.sendFile(path.join(__dirname, '500.html'));
    else
        res.sendFile(path.join(__dirname, '404.html'));
});

mainApp.listen(config.ProxyServePort, () => {
    console.log(`Starting Proxy at *:${config.ProxyServePort}`);
});

errorProxy.listen(config.ProxyErrorsServerPort, () => {
    console.log(`Starting ErrorProxy at *:${config.ProxyErrorsServerPort}`);
})

function checkServersStatus() {
    const routers = config.routers;
    routers.forEach(async (element) => {
        let tmp = element.to.replace("http://", "").replace("https://", "").split(':');
        let status = await tcpPingPort(tmp[0], Number(tmp[1]), {
            socketTimeout: 10000,
            dnsTimeout: 10000,
            dnsServers: ['8.8.8.8']
        });
        servers.set(element.from, status.online);
    });
}
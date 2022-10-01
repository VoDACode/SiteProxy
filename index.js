const express = require("express");
const config = require('config-dynamic');
const { tcpPingPort } = require('tcp-ping-port');
const { createProxyMiddleware } = require("http-proxy-middleware");
const path = require('path');
const mainApp = express();
const errorProxy = express();

let servers = [];
checkServersStatus();
setInterval(checkServersStatus, 10000);
config.util.loadFileConfigs(".\\config");

mainApp.use(
    "/",
    createProxyMiddleware({
        changeOrigin: true,
        ws: true,
        router: async function (req) {
            const host = req.hostname;
            const routers = config.get('routers');

            if (!routers || !Array.isArray(routers))
                throw new Error('Incorrect config parameter "routers"');

            const item = routers.find(p => p.from == host);
            if (!item) {
                req.headers["code"] = 404;
                return `http://${host}:${config.get('ProxyErrorsServerPort')}/`;
            }

            if (!servers.find(p => p.server == item.from).status) {
                req.headers["code"] = 500;
                return `http://${host}:${config.get('ProxyErrorsServerPort')}/`;
            }

            return item.to;
        }
    })
);

if (config.get("api.isEnabled")) {
    errorProxy.get("/_api/proxy-list", (req, res) => {
        if (req.query.apiKey != "" && req.query.apiKey != config.get("api.key")) {
            res.statusCode = 401;
            res.end();
            return;
        }
        res.json(servers);
    });
}

errorProxy.use("/", (req, res) => {
    if (req.headers["code"] == '404')
        res.sendFile(path.join(__dirname, '/404.html'));
    else if (req.headers["code"] == '500')
        res.sendFile(path.join(__dirname, '/500.html'));
    else
        res.sendFile(path.join(__dirname, '/404.html'));
});

mainApp.listen(config.get('ProxyServePort'), () => {
    console.log(`Starting Proxy at *:${config.get('ProxyServePort')}`);
});

errorProxy.listen(config.get('ProxyErrorsServerPort'), () => {
    console.log(`Starting ErrorProxy at *:${config.get('ProxyErrorsServerPort')}`);
})

function checkServersStatus() {
    const routers = config.get('routers');
    routers.forEach(async (element) => {
        let isNew = false;
        if (!servers.find(p => p.server == element.from))
            isNew = true;
        let tmp = element.to.replace("http://", "").replace("https://", "").split(':');
        let status = await tcpPingPort(tmp[0], Number(tmp[1]), {
            socketTimeout: 10000,
            dnsTimeout: 10000,
            dnsServers: ['8.8.8.8']
        });
        if (isNew) {
            servers.push({ server: element.from, status: status.online })
        } else {
            servers.find(p => p.server == element.from).status = status.online;
        }
    });
}
// import third party packages and OS modules
const http = require("http");
const WebSocket = require("ws");
const express = require("express");
const app = express();
const session = require("express-session");
const MongoStore = require("connect-mongo");
const CONFIG = require("./config/config");

// Serve html
// app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.use(express.static("public"));
app.listen(5000, () => console.log("Listening on http port 5000"));

const server = http.createServer();
const wss = new WebSocket.Server({ server });

server.listen(3300, () => console.log("Listening.. on 3300"));

const sessionMiddleware = session({
  secret: "SECRET KEY",
  resave: false,
  saveUninitialized: true,
  cookie: { path: "/", secure: false },
  store: MongoStore.create({
    mongoUrl: CONFIG.MONGODB_URL,
    ttl: 14 * 24 * 60 * 60,
    autoRemove: "native",
  }),
});

wss.on("connection", (ws, request) => {
  console.log("Client connected");
  let session;
  sessionMiddleware(request, {}, () => {
    session = request.session;

    if (!request.session.orders) {
      request.session.orders = {};
    }

    if (!request.session.ordersHistory) {
      request.session.ordersHistory = {};
    }

    ws.on("message", (message) => {
      console.log(`Received message: ${message}`);
      const result = JSON.parse(message);
      console.log(result);
      const userDevice = request.headers["user-agent"];
    
      if (result.command === "placeOrders") {
        const orders = getOrders();

        const messageData = {
          command: "placeOrders",
          orders: orders,
        };
        ws.send(JSON.stringify(messageData));
      }

      if (result.command === "itemPicked") {
        if (!session.orders[userDevice]) {
          session.orders[userDevice] = [];
        }
        if (!session.ordersHistory[userDevice]) {
          session.ordersHistory[userDevice] = [];
        }
        session.orders[userDevice].push(result.orderName, result.orderPrice);
        session.ordersHistory[userDevice].push(
          result.orderName,
          result.orderPrice
        );
      }

      session.save((err) => {
        if (err) {
          console.error(err);
        } else {
          console.log("saved successfully");
        }
      });
    });
  });
  ws.on("close", () => {
    console.log("Client disconnected");
  });
  function getOrders() {
    // This is just an example. You could retrieve orders from a database or API.
    return [
      { id: 1, name: "Pizza", price: "$10.99" },
      { id: 2, name: "Pasta", price: "$8.99" },
      { id: 3, name: "Salad", price: "$5.99" },
    ];
  }
});

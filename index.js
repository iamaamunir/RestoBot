// import third party packages and OS modules
const http = require("http");
const WebSocket = require("ws");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const CONFIG = require("./config/config");
const fs = require("fs");
const express = require("express");
const app = express();

// create server and server public files

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "text/html");
  fs.readFile(`${__dirname}/public/index.html`, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.end(`Error getting the file: ${err}.`);
    } else {
      res.statusCode = 200;
      res.end(data);
    }
  });
});
server.listen(3300, () => console.log("Listening.. on 3300"));

// create websocket server
const wss = new WebSocket.Server({ server });

// session middleware to store session in db

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
app.use(sessionMiddleware);

// websocket connection
wss.on("connection", (ws, request) => {
  console.log("Client connected");
  sessionMiddleware(request, {}, () => {
    //  set session to the request session
    let session;

    session = request.session;

    // console.log(sessionId);
    // create session orders object
    if (!session.orders) {
      session.orders = {};
    }
    // create session orders history object
    if (!session.ordersHistory) {
      session.ordersHistory = {};
    }
    // websocket listening to message from the client
    ws.on("message", (message) => {
      console.log(`Received message: ${message}`);
      const result = JSON.parse(message);

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

      if (result.command === "checkOutButton") {
        if (
          session.orders[userDevice] === undefined ||
          session.orders[userDevice] === null
        ) {
          const orders = getOrders();
          const messageData = {
            command: "No Order",
            message: "No order was placed. Please place an order",
            orders: orders,
          };
          ws.send(JSON.stringify(messageData));
        } else if (session.orders[userDevice].length !== 0) {
          const allOrders = session.orders[userDevice];
          const orderPrices = allOrders.filter((price) =>
            price.startsWith("$")
          );
          const addOrderPrices = orderPrices.reduce(
            (accumulator, currentValue) => {
              const value = parseFloat(currentValue.replace("$", ""));
              return accumulator + value;
            },
            0
          );
          const messageData = {
            command: "checkOut",
            price: `Order checkout. Your total price is $${addOrderPrices}`,
          };
          ws.send(JSON.stringify(messageData));

          session.orders[userDevice] = null;
        }
      }
      if (result.command === "currentOrder") {
        const currentOrder = session.orders[userDevice];
        if (
          session.orders[userDevice] === undefined ||
          session.orders[userDevice] === null
        ) {
          const orders = getOrders();
          const messageData = {
            command: "No Order",
            message: "You haven't placed an order. Please place an order",
            orders: orders,
          };
          ws.send(JSON.stringify(messageData));
        } else if (session.orders[userDevice].length !== 0) {
          const result = [];

          for (let i = 0; i < currentOrder.length; i += 2) {
            const name = currentOrder[i];
            const price = currentOrder[i + 1];

            result.push({ name, price });
          }
          console.log(result);
          const messageData = {
            command: "currentOrder",
            currentOrder: result,
          };

          ws.send(JSON.stringify(messageData));
        }
      }
      if (result.command === "orderHistory") {
        const orderHistory = session.ordersHistory[userDevice];
        if (
          session.orders[userDevice] === undefined ||
          session.orders[userDevice] === null
        ) {
          const orders = getOrders();
          const messageData = {
            command: "No Order",
            message: "You haven't placed an order. Please place an order",
            orders: orders,
          };
          ws.send(JSON.stringify(messageData));
        } else if (session.orders[userDevice].length !== 0) {
          const result = [];

          for (let i = 0; i < orderHistory.length; i += 2) {
            const name = orderHistory[i];
            const price = orderHistory[i + 1];

            result.push({ name, price });
          }
          const messageData = {
            command: "orderHistory",
            orderHistory: result,
          };

          ws.send(JSON.stringify(messageData));
        }
      }
      if (result.command === "cancelOrders") {
        if (session.orders[userDevice]) {
          const orders = session.orders[userDevice];
          console.log(orders);
          const result = [];

          for (let i = 0; i < orders.length; i += 2) {
            const name = orders[i];
            const price = orders[i + 1];

            result.push({ name, price });
          }
          console.log(result);
          const messageData = {
            command: "cancel",
            message: "Pick an order to cancel",
            orders: result,
          };
          ws.send(JSON.stringify(messageData));
        } else if (
          session.orders[userDevice] === undefined ||
          session.orders[userDevice] === null
        ) {
          const messageData = {
            command: "no item",
            message: "You haven't ordered anything yet",
          };
          ws.send(JSON.stringify(messageData));
        }
      }
      if (result.command === "itemCancel") {
        {
          const indexToRemove = session.orders[userDevice].indexOf(
            result.orderName
          );

          session.orders[userDevice].splice(indexToRemove, 2), result.orderId;
        }
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

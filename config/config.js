require('dotenv').config()

const CONFIG = {
    MONGODB_URL: process.env.MONGODB_URL,
    SERVER_PORT: process.env.SERVER_PORT,
    CLIENT_PORT: process.env.CLIENT_PORT
}

module.exports = CONFIG
const { RefreshableAuthProvider, StaticAuthProvider } = require('twitch-auth');
const { ChatClient } = require('twitch-chat-client');
const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;

const { Pool } = require('pg');
//const { workers } = require('cluster');
const database_url = process.env.DATABASE_URL;
const db_pool = new Pool({
    connectionString: database_url,
    ssl: {
        rejectUnauthorized: false
    }
});

const redis = require("redis");
const redis_url = process.env.REDIS_URL;
const redis_client = redis.createClient(redis_url);

const { substring_distance } = require('./lib.js');

async function create_worker(id) {
    const db_client = await db_pool.connect();
    var response = await db_client.query('SELECT twitch_name, access_token, refresh_token, expiry, plan_type FROM access_tokens WHERE twitch_id = $1', [id]);
    if (response.rows.length === 0) {
        return;
    }
    const { twitch_name, access_token: accessToken, refresh_token: refreshToken, expiry, plan_type } = response.rows[0];
    db_client.release();

    const auth = new RefreshableAuthProvider(
        new StaticAuthProvider(clientId, accessToken),
        {
            clientSecret: clientSecret,
            refreshToken: refreshToken,
            expiry: expiry,
            onRefresh: async ({ accessToken, refreshToken, expiryDate }) => {
                const db_client = await db_pool.connect();
                await db_client.query("UPDATE access_tokens SET access_token = $1, refresh_token = $2, expiry = $3 WHERE twitch_id = $4", [accessToken, refreshToken, expiryDate, id])
                db_client.release();
            }
        }
    );

    const chatClient = new ChatClient(auth, { channels: [twitch_name] });
    await chatClient.connect();

    chatClient.onMessage((channel, user, message) => {
        if (message === '>>> ping?') {
            chatClient.say(channel, '<<< Pong!');
        }
        const noramlized = message.normalize("NFD").split('').filter(c => c.match(/[a-zA-Z]/)).join('').toLowerCase();
        var similarity = substring_distance('bigfollowscom', noramlized);
        similarity += substring_distance('buyfollowersprimesandviewers', noramlized);
        if (similarity <= 3) {
            console.log('detected bot:', channel, user, message);
            if (plan_type == 'full') {
                chatClient.purge(channel, user, 'big follows bot');
                // chatClient.ban(channel, user, 'big follows bot');
            } else if (plan_type == 'lite') {
                chatClient.say(channel, "^ that is a spam / scam bot, < I'm a bot too")
            }
        }
    });
    return chatClient;
}

var workers = {};

async function main() {
    const db_client = await db_pool.connect();
    var twitch_ids = await db_client.query('SELECT twitch_id FROM access_tokens');
    db_client.release();

    const redis_client_pub = redis.createClient(redis_url);
    for (row_dict of twitch_ids.rows) {
        var id = row_dict.twitch_id;
        redis_client_pub.publish("launch", id);
    }
    redis_client_pub.quit();
}

redis_client.on("message", async (channel, message) => {
    console.log(channel, message);
    if (channel == "launch") {
        // remove old worker if it existed
        if (message in workers) {
            console.log('removing previous:', message, typeof workers[message])
            await workers[message].quit();
            delete workers[message];
        }
        workers[message] = await create_worker(message);
    } else if (channel == "kill") {
        if (message in workers) {
            await workers[message].quit();
            delete workers[message];
        }
    }
});

redis_client.subscribe("launch");
redis_client.subscribe("kill");

main();
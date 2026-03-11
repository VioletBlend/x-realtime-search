import dotenv from "dotenv";
import express from "express";
import { WebSocketServer } from "ws";

dotenv.config();

const app = express();
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const wss = new WebSocketServer({ server });

async function callXAPI(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${process.env.X_BEARER_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    console.error("X API error:", res.status, await res.text());
    return null;
  }

  return await res.json();
}

let keyword = "猫 OR ねこ";
let lastTweetId = null;

wss.on("connection", ws => {
  ws.on("message", async msg => {
    const data = JSON.parse(msg);

    if (data.type === "setKeyword") {
      keyword = data.keyword;
      lastTweetId = null;
      console.log("検索ワード変更:", keyword);

      await pollSearch();
    }
  });
});

async function pollSearch() {
  if (!keyword) return;

  const url =
    "https://api.x.com/2/tweets/search/recent" +
    `?query=${encodeURIComponent(keyword)}` +
    "&max_results=10" +
    "&expansions=author_id,attachments.media_keys" +
    "&tweet.fields=text,source" +
    "&user.fields=name,username,profile_image_url" +
    "&media.fields=url,preview_image_url";

  const data = await callXAPI(url);
  if (!data || !data.data) return;

  const tweets = data.data;

  const users = {};
  if (data.includes?.users) {
    data.includes.users.forEach(u => (users[u.id] = u));
  }

  const mediaMap = {};
  if (data.includes?.media) {
    data.includes.media.forEach(m => (mediaMap[m.media_key] = m));
  }

  tweets.forEach(t => {
    t.user = users[t.author_id];
    if (t.attachments?.media_keys) {
      t.media = t.attachments.media_keys.map(k => mediaMap[k]).filter(Boolean);
    }
  });

  const newTweets = [];

  if (!lastTweetId) {
    lastTweetId = tweets[0].id;
    newTweets.push(...tweets);
  } else {
    for (const t of tweets) {
      if (t.id === lastTweetId) break;
      newTweets.push(t);
    }
  }

  if (newTweets.length > 0) {
    lastTweetId = tweets[0].id;

    newTweets.reverse();
    newTweets.forEach(tweet => {
      const payload = { data: tweet };
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify(payload));
        }
      });
    });
  }
}

setInterval(pollSearch, 900000);

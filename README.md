# nobigfollows

This bot (app? thing? idk) timeouts the "Wanna be famous?" spam bot from your twitch chat. Go here to register:

https://nobigfollowstwitchbot.herokuapp.com/register/

To unregister the bot from your channel, visit [here](https://nobigfollowstwitchbot.herokuapp.com/register/).

## How it works

Note: This is subject to change, look at the source code in bot.js for the actual behaviour.

Currently, this bot looks for messages that has the phrase "bigfollows.com" and "Buy followers, primes, and viewers", and timeouts the user if the message contains both phrases.

The messages are normalized, and only alphabetic characters are considered when comparing.

The bot actually calculates the distance between messages and the targetted phrases, instead of looking for exact matches, so similar strings (has few typos) are also considered.
import express from 'express'
import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions'
import dotenv from 'dotenv'
import dotenvExpand from 'dotenv-expand'
import mongoose from 'mongoose'

import User from './models/User.js'
import Game from './models/Game.js'

const env = dotenv.config()
dotenvExpand.expand(env)

try {
    console.log('INFO:', 'connecting to database...')
    await mongoose.connect(process.env.MONGODB_URI)
} catch (e) {
    console.log('ERROR:', e)
}

export const app = express()

function verify() {
    const public_key = process.env.PUBLIC_KEY

    return function (req, res, buf, encoding) {
        const signature = req.get('X-Signature-Ed25519')
        const timestamp = req.get('X-Signature-Timestamp')

        const validRequest = verifyKey(buf, signature, timestamp, public_key)
        if (!validRequest) {
            res.status(401).send('Bad request signature')
        }
    }
}

function getDiscordUser(body) {
    if (!body.guild) {
        return { id: body.user.id, name: body.user.global_name }
    }

    return { id: body.member.user.id, name: body.member.user.global_name }
}

app.use(express.json({ verify: verify() }))

app.post('/interactions', async function (req, res) {
    const { type, data } = req.body

    if (type === InteractionType.PING) {
        return res.json({
            type: InteractionResponseType.PONG
        })
    }

    if (type === InteractionType.APPLICATION_COMMAND) {
        const { name, options } = data
        const discordUser = getDiscordUser(req.body)

        if (name === 'tesito') {
            return res.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: 'con pansito'
                }
            })
        }

        if (name === 'add') {
            const option = options.find(option => option.name === 'game')

            let game = await Game.findOne({ name: option.value })
            if (!game) {
                game = await new Game({
                    name: option.value
                }).save()
            }

            let user = await User.findOne({ discord_id: discordUser.id })
            if (!user) {
                user = await new User({ 
                    name: discordUser.name,
                    discord_id: discordUser.id,
                }).save()
            }

            if (user.wishlist.find(id => id.toString() === game._id.toString())) {
                return res.json({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: `The game ${game.name} had already been added to the wishlist`
                    }
                })
            }

            user.wishlist.push(game._id)
            user = await user.save()

            return res.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: `The game **${game.name}** added to the wishlist`
                }
            })
        }

        if (name === 'list') {
            if (!wishList[user]) {
                return res.json({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: 'No items have been found'
                    }
                })
            }

            return res.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: getStringOfItems(user)
                }
            })
        }
    }
})

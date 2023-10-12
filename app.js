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

function getListOfGames(games) {
    if (games.length === 0) {
        return 'No games have been found'
    }

    return games.map(game => `- **${game.name}**`).join('\n')
}

app.use(express.json({ verify: verify() }))

app.post('/interactions', async function (req, res) {
    const { type, data } = req.body
    const discordUser = getDiscordUser(req.body)

    if (type === InteractionType.PING) {
        return res.json({
            type: InteractionResponseType.PONG
        })
    }

    if (type === InteractionType.APPLICATION_COMMAND) {
        const { name, options } = data

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
            let user = await User.findOne({ discord_id: discordUser.id })
            if (!user) {
                user = await new User({
                    name: discordUser.name,
                    discord_id: discordUser.id,
                }).save()
            }

            await user.populate({ path: 'wishlist', options: { limit: 10 }})

            return res.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: getListOfGames(user.wishlist),
                    components: [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    label: 'next',
                                    style: 1,
                                    custom_id: `skip;10;${discordUser.id}`
                                }
                            ]
                        }
                    ]
                }
            })
        }
    }

    if (type === InteractionType.MESSAGE_COMPONENT) {
        if (data.component_type === 2) {
            if (data.custom_id.startsWith('skip')) {
                if (data.custom_id.endsWith(discordUser.id)) {
                    const user = await User.findOne({ discord_id: discordUser.id })

                    const custom_id_array = data.custom_id.split(';')
                    const skip = parseInt(custom_id_array[1])
                    const limit = 10

                    const len = user.wishlist.length

                    await user.populate({ path: 'wishlist', options: { skip, limit }})

                    if (skip === 0) {
                        return res.json({
                            type: InteractionResponseType.UPDATE_MESSAGE,
                            data: {
                                content: getListOfGames(user.wishlist),
                                components: [
                                    {
                                        type: 1,
                                        components: [
                                            {
                                                type: 2,
                                                label: 'next',
                                                style: 1,
                                                custom_id: `skip;10;${discordUser.id}`
                                            }
                                        ]
                                    }
                                ]
                            }
                        })
                    } else if (skip + limit > len) {
                        return res.json({
                            type: InteractionResponseType.UPDATE_MESSAGE,
                            data: {
                                content: getListOfGames(user.wishlist),
                                components: [
                                    {
                                        type: 1,
                                        components: [
                                            {
                                                type: 2,
                                                label: 'prev',
                                                style: 1,
                                                custom_id: `skip;${skip - limit};${discordUser.id}`
                                            }
                                        ]
                                    }
                                ]
                            }
                        })
                    } else {
                        return res.json({
                            type: InteractionResponseType.UPDATE_MESSAGE,
                            data: {
                                content: getListOfGames(user.wishlist),
                                components: [
                                    {
                                        type: 1,
                                        components: [
                                            {
                                                type: 2,
                                                label: 'prev',
                                                style: 1,
                                                custom_id: `skip;${skip - limit};${discordUser.id}`
                                            },
                                            {
                                                type: 2,
                                                label: 'next',
                                                style: 1,
                                                custom_id: `skip;${skip + limit};${discordUser.id}`
                                            }
                                        ]
                                    }
                                ]
                            }
                        })
                    }
                }
            }
        }
        return res.status(401).end()
    }
})

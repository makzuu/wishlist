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

    return games.map((game, index) => `${index + 1}. **${game.name}**`).join('\n')
}

function getOptionButtons(games, discordUserId) {
    return {
        type: 1,
        components: [
            ...games.map((game, index) => ({
                type: 2,
                label: `${index + 1}`,
                style: 2,
                custom_id: `options;${game._id};${discordUserId}`
            }))
        ]
    }
}

function getNavButtons(skip, limit, discordUserId, len) {

    const paginationButtons = {
        type: 1,
        components: []
    }

    const leftButton = {
        type: 2,
        label: 'prev',
        style: 1,
        custom_id: `skip;${skip-limit};${discordUserId}`
    }

    const rightButton = {
        type: 2,
        label: 'next',
        style: 1,
        custom_id: `skip;${skip+limit};${discordUserId}`
    }

    if (len <= limit) {
        return paginationButtons
    } else if (skip === 0) {
        paginationButtons.components.push(rightButton)
    } else if (skip + limit >= len) {
        paginationButtons.components.push(leftButton)
    } else {
        paginationButtons.components.push(leftButton, rightButton)
    }

    return paginationButtons
}

function getComponents(games, discordUserId, skip, limit, len) {
    const optionsButtons = getOptionButtons(games, discordUserId)
    const navButtons = getNavButtons(skip, limit, discordUserId, len)

    const components = []

    if (optionsButtons.components.length !== 0) {
        components.push(optionsButtons)
    }

    if (navButtons.components.length !== 0) {
        components.push(navButtons)
    }

    return components
}

const LIMIT = 5
const SKIP = 5

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
                    content: 'con pansito',
                    components: []
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

            const limit = SKIP
            const skip = 0
            const len = user.wishlist.length

            await user.populate({ path: 'wishlist', options: { limit }})

            return res.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: getListOfGames(user.wishlist),
                    components: getComponents(user.wishlist, discordUser.id, skip, limit, len)
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
                    const limit = LIMIT

                    const len = user.wishlist.length

                    await user.populate({ path: 'wishlist', options: { skip, limit }})

                    return res.json({
                        type: InteractionResponseType.UPDATE_MESSAGE,
                        data: {
                            content: getListOfGames(user.wishlist),
                            components: getComponents(user.wishlist, discordUser.id, skip, limit, len)
                        }
                    })
                }
            }
            if (data.custom_id.startsWith('options')) {
                if (data.custom_id.endsWith(discordUser.id)) {
                    const custom_idArray = data.custom_id.split(';')
                    const gameId = custom_idArray[1]
                    const game = await Game.findById(gameId)

                    return res.json({
                        type: InteractionResponseType.UPDATE_MESSAGE,
                        data: {
                            content: getListOfGames([game]),
                            components: [
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 2,
                                            label: 'show',
                                            style: 1,
                                            custom_id: `show;${game._id};${discordUser.id}`
                                        },
                                        {
                                            type: 2,
                                            label: 'delete',
                                            style: 4,
                                            custom_id: `delete;${game._id};${discordUser.id}`
                                        }
                                    ]
                                }
                            ]
                        }
                    })
                }
            }
            if (data.custom_id.startsWith('delete')) {
                if (data.custom_id.endsWith(discordUser.id)) {
                    const custom_idArray = data.custom_id.split(';')

                    const gameId = custom_idArray[1]
                    const game = await Game.findByIdAndRemove(gameId)

                    const user = await User.findOne({ discord_id: discordUser.id })
                    user.wishlist = user.wishlist.filter(id => id.toString() !== gameId.toString())
                    await user.save()

                    return res.json({
                        type: InteractionResponseType.UPDATE_MESSAGE,
                        data: {
                            content: `game **${game.name}** was deleted`,
                            components: []
                        }
                    })
                }
            }
            if (data.custom_id.startsWith('show')) {
                if (data.custom_id.endsWith(discordUser.id)) {
                    return res.json({
                        type: InteractionResponseType.UPDATE_MESSAGE,
                        data: {
                            content: 'in construction',
                            components: []
                        }
                    })
                }
            }
        }
        return res.status(401).end()
    }
})

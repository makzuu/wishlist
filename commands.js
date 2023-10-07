import 'dotenv/config'
import fetch from 'node-fetch'

const TEST_COMMAND = {
    name: 'tesito',
    description: 'para ver si funca o no funca na',
}

const ADD_COMMAND = {
    name: 'add',
    description: 'add an item to your wishlist',
    options: [
        {
            type: 3,
            name: 'item',
            description: 'the item you want',
            required: 1,
        }
    ]
}

const LIST_COMMAND = {
    name: 'list',
    description: 'list of items in your wishlist',
}

async function updateCommands(commands) {
    const appId = process.env.APP_ID
    const baseUrl = 'https://discord.com/api/v10/'
    const endpoint = `applications/${appId}/commands`

    const url = baseUrl + endpoint

    const discordToken = process.env.DISCORD_TOKEN

    const body = JSON.stringify(commands)

    try {
        const res = await fetch(url, {
            headers: {
                Authorization: `Bot ${discordToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
            },
            method: 'PUT',
            body: body,
        })
        if (!res.ok) {
            return console.error(`Error: ${res.status} ${res.statusText}`)
        }
        console.log(`Info: ${res.status} ${res.statusText}`)
    } catch (err) {
        console.error(err)
    }
}

updateCommands([
    TEST_COMMAND, ADD_COMMAND, LIST_COMMAND
])

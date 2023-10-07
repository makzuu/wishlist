import express from 'express'
import 'dotenv/config'
import { 
    InteractionType, InteractionResponseType, verifyKey
} from 'discord-interactions'

const wishList = {}

const app = express()

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

app.use(express.json({ verify: verify() }))

app.use(function (req, res, next) {
    console.log('INFO:', req.method, '-',  req.url)
    next()
})

app.post('/interactions', function (req, res) {
    const { type, data } = req.body

    if (type === InteractionType.PING) {
        return res.json({
            type: InteractionResponseType.PONG
        })
    }

    if (type === InteractionType.APPLICATION_COMMAND) {
        const { name, options } = data
        let { user } = req.body

        if (!user) user = req.body.member.user

        if (name === 'tesito') {
            return res.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: 'con pansito'
                }
            })
        }

        if (name === 'add') {
            const item = options.find(option => option.name === 'item')

            if (!wishList[user]) {
                wishList[user] = {
                    items: [ item.value ]
                }
            } else {
                wishList[user].items.push(item.value)
            }

            return res.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: `**${item.value}** added!`
                }
            })
        }
    }
})

const port = process.env.PORT || 3000
app.listen(port, function () {
    console.log(`INFO: listening in port ${port}`)
})

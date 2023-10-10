import dotenv from 'dotenv'

dotenv.config()

import { app } from './app.js'

const port = process.env.PORT || 3000
app.listen(port, function () {
    console.log(`INFO: listening in port ${port}`)
})

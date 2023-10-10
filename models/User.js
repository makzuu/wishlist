import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
    name: String,
    discord_id: String,
    wishlist: {
        type: [mongoose.Types.ObjectId],
        ref: 'Game'
    }
})

export default mongoose.model('User', userSchema)

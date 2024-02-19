import mongoose from "mongoose";
let ContactConversation = mongoose.createConnection('mongodb://127.0.0.1:27017/Chat365');
const ContactSchema = new mongoose.Schema(
  {
      userFist: {
        type: Number,
        default:0,
      },
      userSecond: {
        type: Number,
        default:0,
      },
      bestFriend:{
        type: Number,
        default:0,
      }
  },
  { collection: 'Contacts', 
    versionKey: false   // loai bo version key 
  }
);

export default ContactConversation.model("Contact", ContactSchema);
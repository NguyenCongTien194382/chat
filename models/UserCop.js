import mongoose from "mongoose";
const UserCopSchema = new mongoose.Schema(
  {
    _id:{
      type: Number,
      default:0,
    },
    id365: {
      type: Number,
      default:0,
    },
    type365: {
      type: Number,
      default:0,
    },
    email: {
      type: String,
      default:"",
    },
    password: {
      type: String,
      default:"",
    },
    phone: {
      type: String,
      default:"",
    },
    userName: {
      type: String,
      default:"",
    },
    avatarUser: {
      type: String,
      default:"",
    },
    status: {
        type: String,
        default:"",
    },
    statusEmotion: {
        type: Number,
        default:0,
    },
    lastActive: {
        type: Date,
        default: new Date(),
    },
    active: {
        type: Number,
        default:0,
    },
    isOnline: {
        type: Number,
        default:0,
    },
    looker: {
        type: Number,
        default:0,
    },
    companyId: {
        type: Number,
        default:0,
    },
    companyName: {
        type: String,
        default:"",
    },
    notificationPayoff: {
          type: Number,
          default:0,
    },
    notificationCalendar: {
          type: Number,
          default:0,
    },
    notificationReport: {
          type: Number,
          default:0,
    },
    notificationOffer: {
          type: Number,
          default:0,
    },
    notificationPersonnelChange: {
          type: Number,
          default:0,
    },
    notificationRewardDiscipline: {
          type: Number,
          default:0,
    },
    notificationNewPersonnel: {
          type: Number,
          default:0,
    },
    notificationChangeProfile: {
        type: Number,
        default:0,
    },
    notificationTransferAsset: {
          type: Number,
          default:0,
    },
    acceptMessStranger: {
          type: Number,
          default:0,
    },
    idTimViec: {
          type: Number,
          default:0,
    },
    fromWeb: {
          type: String,
          default:"",
    },
    secretCode: {
          type: String,
          default:"",
    },
    HistoryAccess:
    [
        {
            IdDevice: {
                  type: String,
                  default:"",
            },
            IpAddress: {
                  type: String,
                  default:"",
            },
            NameDevice: {
                  type: String,
                  default:"",
            },
            Time: {
                  type: Date,
                  default: new Date(),
            },
            AccessPermision: {
                  type: Boolean,
                  default: false, 
            },
        }
    ],
    latitude :{
      type: Number,
      default:0,
    },
    longtitude :{
      type: Number,
      default:0,
    },
    removeSugges:{
      type: [Number],
      default:[],
    },
    userNameNoVn:{
      type: String,
      default:""
    }
  },
  { collection: 'UserCop',  // cài đặt tên cho conversations kết nối đến 
    versionKey: false   // loai bo version key  
  }  
);

export default mongoose.model("UserCop", UserCopSchema);
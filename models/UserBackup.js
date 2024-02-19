import mongoose from "mongoose";
const UserBackupSchema = new mongoose.Schema(
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
          default:1,
    },
    notificationCalendar: {
          type: Number,
          default:1,
    },
    notificationReport: {
          type: Number,
          default:1,
    },
    notificationOffer: {
          type: Number,
          default:1,
    },
    notificationPersonnelChange: {
          type: Number,
          default:1,
    },
    notificationRewardDiscipline: {
          type: Number,
          default:1,
    },
    notificationNewPersonnel: {
          type: Number,
          default:1,
    },
    notificationChangeProfile: {
        type: Number,
        default:1,
    },
    notificationTransferAsset: {
          type: Number,
          default:1,
    },
    acceptMessStranger: {
          type: Number,
          default:1,
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
    notificationAcceptOffer: {
      type: Number,
      default:1,
      },
      notificationAllocationRecall: {
            type: Number,
            default:1,
      },
      notificationChangeSalary: {
            type: Number,
            default:1,
      },
      notificationCommentFromRaoNhanh: {
            type: Number,
            default:1,
      },
      notificationCommentFromTimViec: {
            type: Number,
            default:1,
      },
      notificationDecilineOffer: {
            type: Number,
            default:1,
      },
      notificationMissMessage: {
            type: Number,
            default:1,
      },
      notificationNTDExpiredPin: {
            type: Number,
            default:1,
      },
      notificationNTDExpiredRecruit: {
            type: Number,
            default:1,
      },
      notificationNTDPoint: {
            type: Number,
            default:1,
      },
      notificationSendCandidate: {
            type: Number,
            default:1,
      },
      notificationTag: {
            type: Number,
            default:1,
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
    },
//     verified:{
//       type: Number,
//       default:0,
//     }

  },
  { collection: 'UserBackup',  // cài đặt tên cho conversations kết nối đến 
    versionKey: false   // loai bo version key  
  }  
);

export default mongoose.model("UserBackup",UserBackupSchema);
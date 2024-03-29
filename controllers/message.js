﻿﻿import Conversation from "../models/Conversation.js";
import axios from 'axios'
import { createError } from "../utils/error.js";
import RequestContact from "../models/RequestContact.js";
import UsersClassified from "../models/UsersClassified.js";
import FirstMessageDay from "../models/FirstMessageDay.js";
import FastMessage from "../models/FastMessage.js";
import Counter from "../models/Counter.js";
import Contact from "../models/Contact.js";
import * as nodemailer from 'nodemailer'
import { Messages, MessageQuote, MessagesDB, EmotionMessageDBDefault, FileSendDB, infoLink, InfoSupportDB, InfoLiveChat, LiveChatDB } from "../functions/fModels/fMessage.js";
import { fInfoLink, fInfoFile, fEmotion, fMessageQuote, fInfoFile2 } from "../functions/fModels/fMessages.js";
import { getLinkPreview } from "link-preview-js";
import io from 'socket.io-client';
import qs from 'qs';
import cron from 'node-cron'
import multer from 'multer';
import Birthday from "../models/Birthday.js"
import User from "../models/User.js";
import fs from 'fs'
import date from "date-and-time"
import e from "cors";
import { urlImgHost } from '../utils/config.js'
import { downloadFile, convertBase64ToPDF } from "../functions/DownloadFile.js";
import { FCreateNewConversation } from "../functions/Fconversation.js";
import request from 'request'
import mqtt from 'mqtt'
import sharp from "sharp";
import { FSendMessage } from "../functions/fApi/message.js";
import { checkPhoneNumberInMessage } from "../services/message.service.js";
import { checkToken } from "../utils/checkToken.js";
import { FReadMessage } from '../functions/fApi/conversation.js'
import { FGetListConversationIdStrange } from '../functions/fApi/conversation.js'
const socket = io.connect('http://127.0.0.1:4000', {
  secure: true,
  enabledTransports: ["wss"],
  transports: ['websocket', 'polling'],
});
const connectUrl = 'mqtt://43.239.223.157:1883';
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
const client = mqtt.connect(connectUrl,
  {
    clientId,
    clean: true,
    connectTimeout: 4000,
    username: 'admin',
    password: 'Tuananh050901',
    reconnectPeriod: 1000,
  }
);
const myConsole = new console.Console(fs.createWriteStream('./logs/message.log'));
const myConsole2 = new console.Console(fs.createWriteStream('./logs.sendCvlog'));
const SendMessageMqtt = (listMember, mess) => {
  try {
    for (let i = 0; i < listMember.length; i++) {
      let panel = `${listMember[i]}_sendMessage`;
      client.publish(panel, JSON.stringify(mess), () => {
        console.log("sent mqtt message successfully");
        return true;
      });
      let count = 1;
      let flagsend = 1;
      let IntervalSendMessageMqtt = setInterval(async () => {
        if (count < 14) {
          if (flagsend == 1) {
            client.publish(panel, JSON.stringify(mess), () => {
              console.log(count);
              return true
            });
            count = count + 1;
          }
        }
        else {
          flagsend = 0;
          clearInterval(IntervalSendMessageMqtt);
        };
        return true;
      }, 1000);
      let count_minute = 0;
      let IntervalSendMessageMqtt_minute = setInterval(async () => {
        if (count_minute < 60) {
          client.publish(panel, JSON.stringify(mess), () => {
            console.log(count_minute);
            return true;
          });
          count_minute = count_minute + 15;
        }
        else {
          clearInterval(IntervalSendMessageMqtt_minute);
        };
        return true;
      }, 15000);
      return true;
    }
  }
  catch (e) {
    console.log("Error SendMessageMqtt", e);
    return false;
  }
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(`C:/Chat365/publish/wwwroot/uploads`)) {
      fs.mkdirSync(`C:/Chat365/publish/wwwroot/uploads`);
    }
    cb(null, `C:/Chat365/publish/wwwroot/uploads`)
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() * 10000 + 621355968000000000 + '-' + 'voice.mp3');
  }
});

export const uploadVoice = multer({
  storage: storage,
})


export const TakeListDiaryConversation = async (req, res, next) => {

  // dùng vòng for => Truy vấn 10 lần 
  if (req.body.token) {
    let check = await checkToken(req.body.token);
    if (check && check.status) {
      console.log("Token hop le, TakeListDiaryConversation")
    }
    else {
      return res.status(404).json(createError(404, "Invalid token"));
    }
  }
  try {
    if (req.body && req.body.conversationId && req.body.time && Number(req.body.conversationId)) {

      if (Number(req.body.time) === 0) {
        let result = await Conversation.aggregate([
          {
            $match:
              { _id: Number(req.body.conversationId) },
          },
          {
            $project: {
              messageList: {
                $slice: [  // để giới hạn kết quả trả về 
                  {
                    $filter: {
                      input: "$messageList",
                      as: "messagelist",
                      cond: {
                        $eq: ["$$messagelist.messageType", "DiaryElement"]
                      },
                    }
                  },
                  -10
                ]
              }
            }
          }
        ]);
        let listDiary = result[0].messageList;
        // sắp xếp 
        listDiary.sort((a, b) => {
          if (new Date(a.createAt) < new Date(b.createAt)) {
            return 1;
          }
          if (new Date(a.createAt) > new Date(b.createAt)) {
            return -1;
          }
          return 0;
        });
        for (let i = 0; i < listDiary.length; i++) {
          let count = await Conversation.aggregate([
            {
              $match:
                { _id: Number(req.body.conversationId) },
            },
            {
              $project: {
                "total": {
                  "$size": {
                    $filter: {
                      input: "$messageList",
                      as: "messagelist",
                      cond: {
                        $and: [
                          {
                            $regexMatch: {
                              input: "$$messagelist.messageType",  // nhớ kỹ input 
                              regex: new RegExp(String(listDiary[i]._id), 'i')
                            }
                          },
                          {
                            $regexMatch: {
                              input: "$$messagelist.messageType",  // nhớ kỹ input 
                              regex: new RegExp("Comment", 'i')
                            }
                          }
                        ]
                      },
                    }
                  }
                }
              }
            }
          ]);

          listDiary[i].countComment = Number(count[0].total);
          if (listDiary[i].emotion.Emotion1 == "") {
            listDiary[i].countLike = 0;
          }
          else {
            listDiary[i].countLike = String(listDiary[i].emotion.Emotion1).split(",").length;
          }
        }
        res.status(200).json({
          data: {
            result: true,
            message: "Lấy thông tin thành công",
            listDiary,
            countDiary: listDiary.length
          },
          error: null
        });
      }
      // chia case => Giúp tối ưu performance => dễ mở rộng 
      else {
        if (new Date(String(req.body.time))) {
          let result = await Conversation.aggregate([
            {
              $match:
                { _id: Number(req.body.conversationId) },
            },
            {
              $project: {
                messageList: {
                  $slice: [  // để giới hạn kết quả trả về 
                    {
                      $filter: {
                        input: "$messageList",
                        as: "messagelist",
                        cond: {
                          $and: [
                            { $eq: ["$$messagelist.messageType", "DiaryElement"] },
                            { $lte: ["$$messagelist.createAt", new Date(String(req.body.time))] }
                          ]
                        },
                      }
                    },
                    -10
                  ]
                }
              }
            }
          ]);
          let listDiary = result[0].messageList;
          listDiary.sort((a, b) => {
            if (new Date(a.createAt) < new Date(b.createAt)) {
              return 1;
            }
            if (new Date(a.createAt) > new Date(b.createAt)) {
              return -1;
            }
            return 0;
          });
          for (let i = 0; i < listDiary.length; i++) {
            let count = await Conversation.aggregate([
              {
                $match:
                  { _id: Number(req.body.conversationId) },
              },
              {
                $project: {
                  "total": {
                    "$size": {
                      $filter: {
                        input: "$messageList",
                        as: "messagelist",
                        cond: {
                          $and: [
                            {
                              $regexMatch: {
                                input: "$$messagelist.messageType",  // nhớ kỹ input 
                                regex: new RegExp(String(listDiary[i]._id), 'i')
                              }
                            },
                            {
                              $regexMatch: {
                                input: "$$messagelist.messageType",  // nhớ kỹ input 
                                regex: new RegExp("Comment", 'i')
                              }
                            }
                          ]
                        },
                      }
                    }
                  }
                }
              }
            ]);

            listDiary[i].countComment = Number(count[0].total);
            if (listDiary[i].emotion.Emotion1 == "") {
              listDiary[i].countLike = 0;
            }
            else {
              listDiary[i].countLike = String(listDiary[i].emotion.Emotion1).split(",").length;
            }
          }
          res.status(200).json({
            data: {
              result: true,
              message: "Lấy thông tin thành công",
              listDiary,
              countDiary: listDiary.length
            },
            error: null
          });
        }
        else {
          res.status(200).json(createError(200, "Time truyền lên không hợp lệ"));
        }
      }
    }
    else {
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  }
  catch (e) {
    console.log(e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

export const TakeListUserLike = async (req, res, next) => {

  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status) {
        console.log("Token hop le, TakeListUserLike")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body && req.body.listUserId) {
      let info = req.body;
      if (info.listUserId == "") {
        res.status(200).json({
          data: {
            result: false,
            message: "Không có Id truyền lên",
            listUser: []
          },
          error: null
        });
      }
      else {
        let listUserId = [];
        for (let i = 0; i < String(info.listUserId).split(",").length; i++) {
          listUserId.push(Number(String(info.listUserId).split(",")[i]))
        }
        let listUser = await User.find({ _id: { $in: listUserId } }, { userName: 1, avatarUser: 1 }).lean();
        res.status(200).json({
          data: {
            result: true,
            message: "Lấy thông tin thành công",
            listUser
          },
          error: null
        });
      }
    }
    else {
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  }
  catch (e) {
    console.log(e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

export const TakeListComment = async (req, res, next) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status) {
        console.log("Token hop le, TakeListComment")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body && req.body.conversationId && Number(req.body.conversationId) && req.body.messageId) {
      let result = await Conversation.aggregate([
        {
          $match:
            { _id: Number(req.body.conversationId) },
        },
        {
          $project: {
            messageList: {

              $filter: {
                input: "$messageList",
                as: "messagelist",
                cond: {
                  $and: [
                    {
                      $regexMatch: {
                        input: "$$messagelist.messageType",  // nhớ kỹ input 
                        regex: new RegExp(String(req.body.messageId), 'i')
                      }
                    },
                    {
                      $regexMatch: {
                        input: "$$messagelist.messageType",  // nhớ kỹ input 
                        regex: new RegExp("Comment", 'i')
                      }
                    }
                  ]
                },
              }

            }
          }
        }
      ]);
      if (result) {
        res.status(200).json({
          data: {
            result: true,
            message: "Lấy thông tin thành công",
            result
          },
          error: null
        });
      }
    }
    else {
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  }
  catch (e) {
    console.log(e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

export const Dislike = async (req, res, next) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.userId)) {
        console.log("Token hop le, Dislike")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body && req.body.conversationId && Number(req.body.conversationId) && req.body.messageId && req.body.userId && Number(req.body.userId)) {
      let result = await Conversation.aggregate([
        {
          $match:
            { _id: Number(req.body.conversationId) },
        },
        {
          $project: {
            messageList: {
              $slice: [  // để giới hạn kết quả trả về 
                {
                  $filter: {
                    input: "$messageList",
                    as: "messagelist",
                    cond: {
                      $eq: ["$$messagelist._id", String(req.body.messageId)]
                    },
                  }
                },
                -10
              ]
            }
          }
        }
      ]);
      if (result) {
        let ListUserLike = result[0].messageList[0].emotion.Emotion1;
        if (String(ListUserLike).split(",")[0] == String(req.body.userId)) {
          ListUserLike = String(ListUserLike).replace(`${String(req.body.userId)},`, "");
        }
        else {
          ListUserLike = String(ListUserLike).replace(`,${String(req.body.userId)}`, "");
        }
        //db.Conversations.updateOne({_id:4,"messageList.messageType":"text"},{$set:{"messageList.$.messageType":"DiaryElement"}})
        let update = await Conversation.findOneAndUpdate(
          {
            _id: Number(req.body.conversationId),
            "messageList._id": String(req.body.messageId)
          },
          { $set: { "messageList.$.emotion.Emotion1": ListUserLike } }
        )
        if (update) {
          res.status(200).json({
            data: {
              result: true,
              message: "Dislike thành công"
            },
            error: null
          });
        }
      }
    }
    else {
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  }
  catch (e) {
    console.log(e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

// báo xấu 
export const NotifySpam = async (req, res, next) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.userId)) {
        console.log("Token hop le, NotifySpam")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body && req.body.conversationId && Number(req.body.conversationId) && req.body.messageId && req.body.userId && Number(req.body.userId) && req.body.nameuser && String(req.body.nameuser)) {
      let result = await Conversation.aggregate([
        {
          $match:
            { _id: Number(req.body.conversationId) },
        },
        {
          $project: {
            messageList: {
              $slice: [  // để giới hạn kết quả trả về 
                {
                  $filter: {
                    input: "$messageList",
                    as: "messagelist",
                    cond: {
                      $eq: ["$$messagelist._id", String(req.body.messageId)]
                    },
                  }
                },
                -10
              ]
            }
          }
        }
      ]);
      if (result) {

        let user = await User.find({ _id: Number(result[0].messageList[0].senderId) }, { userName: 1 }).lean();
        if (user && user.length > 0) {
          let sendmes = await axios({
            method: "post",
            url: "http://43.239.223.142:3005/Message/SendMessage",
            data: {
              MessageID: '',
              ConversationID: Number(req.body.conversationId),
              SenderID: Number(req.body.userId),
              MessageType: "notification",
              Message: `${req.body.nameuser} báo xấu bài viết trong nhật ký chung của ${user[0].userName} : ${result[0].messageList[0].message.slice(0, 20)}...`,
              Emotion: 1,
              Quote: "",
              Profile: "",
              ListTag: "",
              File: "",
              ListMember: "",
              IsOnline: [],
              IsGroup: 1,
              ConversationName: '',
              DeleteTime: 0,
              DeleteType: 0,
            },
            headers: { "Content-Type": "multipart/form-data" }
          });
          if (sendmes) {
            res.status(200).json({
              data: {
                result: true,
                message: "Lấy thông tin thành công",
                result
              },
              error: null
            });
          }
        }
      }
    }
    else {
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  }
  catch (e) {
    console.log(e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}


// tin nhắn đồng thời. 
export const SendManyMesByArrayId = async (req, res, next) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.SenderId)) {
        console.log("Token hop le, SendManyMesByArrayId")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body && req.body.SenderId && req.body.content && req.body.ArrayUserId && (String(req.body.ArrayUserId).includes("["))) {
      let listUserId = [];
      let dataReceived = req.body;
      // xử lý dữ liệu mảng truyền lên dạng form-data hoặc json.
      if (dataReceived.ArrayUserId.includes("[")) {
        let StringListUserId = dataReceived.ArrayUserId;
        StringListUserId = StringListUserId.replace("[", "");
        StringListUserId = StringListUserId.replace("]", "");
        let listUserIdString = StringListUserId.split(",");
        for (let i = 0; i < listUserIdString.length; i++) {
          if (Number(listUserIdString[i])) {
            listUserId.push(Number(listUserIdString[i]))
          }
        }
      }
      else {
        if (dataReceived.ArrayUserId.length && dataReceived.ArrayUserId.length > 0) {
          for (let i = 0; i < dataReceived.ArrayUserId.length; i++) {
            // đảm bảo các phần tử trong mảng userId đều là số
            if (Number(dataReceived.ArrayUserId[i])) {
              listUserId.push(Number(dataReceived.ArrayUserId[i]))
            }
          }
        }
        else {
          listUserId = [];
        }
      }

      let listConversationId = [];
      let listConversationIdFist = [];

      listConversationIdFist = await Promise.all(
        listUserId.map((userId) => {
          return axios({
            method: "post",
            url: "http://43.239.223.142:3005/Conversation/CreateNewConversation",
            data: {
              userId: Number(req.body.SenderId),
              contactId: Number(userId)
            },
            headers: { "Content-Type": "multipart/form-data" }
          });
        })
      )

      for (let i = 0; i < listConversationIdFist.length; i++) {
        if (!isNaN(listConversationIdFist[i].data.data.conversationId)) {
          listConversationId.push(Number(listConversationIdFist[i].data.data.conversationId))
        }
      }
      const list = await Promise.all( // send liên tục => tối ưu performance 
        listConversationId.map((ConversationId) => {
          return axios({
            method: "post",
            url: "http://43.239.223.142:3005/Message/SendMessage",
            data: {
              MessageID: '',
              ConversationID: Number(ConversationId),
              SenderID: Number(dataReceived.SenderId),
              MessageType: "text",
              Message: `${dataReceived.content}`,
              Emotion: 1,
              Quote: "",
              Profile: "",
              ListTag: "",
              File: "",
              ListMember: "",
              IsOnline: [],
              IsGroup: 0,
              ConversationName: '',
              DeleteTime: 0,
              DeleteType: 0,
            },
            headers: { "Content-Type": "multipart/form-data" }
          })
        })
      );
      if (list) {
        if (list.length && list.length > 0) {
          res.json({
            data: {
              result: true,
              message: "Gửi thành công",
              countMessage: list.length
            },
            error: null
          })
        }
        else {
          res.status(200).json(createError(200, "Gửi tin nhắn không thành công"));
        }
      }
    }
    else {
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  }
  catch (e) {
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

export const SendManyMesByClassId = async (req, res, next) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.SenderId)) {
        console.log("Token hop le, SendManyMesByClassId")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body && req.body.SenderId && (!isNaN(req.body.SenderId)) && req.body.content && req.body.IdClass) {
      let listUserId = [];
      let dataReceived = req.body;

      let classUser = await UsersClassified.findOne({ _id: String(req.body.IdClass) }).lean(); // findOne không tìm thấy thì không đi vào try catch 
      if (classUser) {
        if (classUser.IdOwner) {
          if (classUser.IdOwner == req.body.SenderId) {
            listUserId = classUser.listUserId;
            let listConversationId = [];
            let listConversationIdFist = [];
            listConversationIdFist = await Promise.all(
              listUserId.map((userId) => {
                return axios({
                  method: "post",
                  url: "http://43.239.223.142:3005/Conversation/CreateNewConversation",
                  data: {
                    userId: Number(req.body.SenderId),
                    contactId: Number(userId)
                  },
                  headers: { "Content-Type": "multipart/form-data" }
                });
              })
            )

            for (let i = 0; i < listConversationIdFist.length; i++) {
              if (!isNaN(listConversationIdFist[i].data.data.conversationId)) {
                listConversationId.push(Number(listConversationIdFist[i].data.data.conversationId))
              }
            }
            const list = await Promise.all( // send liên tục => tối ưu performance 
              listConversationId.map((ConversationId) => {
                return axios({
                  method: "post",
                  url: "http://43.239.223.142:3005/Message/SendMessage",
                  data: {
                    MessageID: '',
                    ConversationID: Number(ConversationId),
                    SenderID: Number(dataReceived.SenderId),
                    MessageType: "text",
                    Message: `${dataReceived.content}`,
                    Emotion: 1,
                    Quote: "",
                    Profile: "",
                    ListTag: "",
                    File: "",
                    ListMember: "",
                    IsOnline: [],
                    IsGroup: 0,
                    ConversationName: '',
                    DeleteTime: 0,
                    DeleteType: 0,
                  },
                  headers: { "Content-Type": "multipart/form-data" }
                })
              })
            );
            if (list) {
              if (list.length && list.length > 0) {
                res.json({
                  data: {
                    result: true,
                    message: "Gửi thành công",
                    countMessage: list.length
                  },
                  error: null
                })
              }
              else {
                res.status(200).json(createError(200, "Gửi tin nhắn không thành công"));
              }
            }
          }
          else {
            res.status(200).json(createError(200, "Bạn không thể gửi tin nhắn đồng thời với nhãn dán này"));
          }
        }
        else {
          res.status(200).json(createError(200, "Không tìm thấy nhãn dán phù hợp"));
        }
      }
      else {
        res.status(200).json(createError(200, "Không tìm thấy nhãn dán phù hợp"));
      }
    }
    else {
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  }
  catch (e) {
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

function localfile(IdDevice, pathFile) {

  return {
    IdDevice: IdDevice,
    pathFile: pathFile
  }
};

let arrayAntiSpamLoadMessage = [];
const HandleUntiLoadMessage = (adminId, conversationId) => {
  try {
    let obj = arrayAntiSpamLoadMessage.find((e) => (e.adminId == adminId) && (e.conversationId == conversationId)) || null;
    let now = new Date().getTime() / 1000;
    if (obj) {
      arrayAntiSpamLoadMessage = arrayAntiSpamLoadMessage.filter((e) => (e.adminId != adminId) && (e.conversationId != conversationId));
      arrayAntiSpamLoadMessage.push({
        time: now,
        adminId: adminId,
        conversationId: conversationId
      });
      if ((now - obj.time) < 2) {
        return false;
      }
      else {
        return true;
      }
    }
    else {
      arrayAntiSpamLoadMessage = arrayAntiSpamLoadMessage.filter((e) => (e.adminId != adminId) && (e.conversationId != conversationId));
      arrayAntiSpamLoadMessage.push({
        time: now,
        adminId: adminId,
        conversationId: conversationId
      });
      return true;
    }
  }
  catch (e) {
    console.log(e, 'error HandleUntiLoadMessage');
    return false;
  }
}
// load message 
// export const LoadMessage = async (req, res, next) => {
//   try {
//     console.log(req.body);
//     if (req.body.token) {
//       let check = await checkToken(req.body.token);
//       if (check && check.status) {
//         console.log("Token hop le, LoadMessage")
//       }
//       else {
//         return res.status(404).json(createError(404, "Invalid token"));
//       }
//     }
//     if (req.body && req.body.conversationId && (!isNaN(req.body.conversationId)) && Number(req.body.conversationId)) {
//       let countMess = await Conversation.aggregate([
//         { $match: { _id: Number(req.body.conversationId) } },
//         { $project: { count: { $size: "$messageList" } } }
//       ]);
//       let countMessReturn;
//       let listMess = Number(req.body.listMess) || 0;
//       // if (listMess == 0) {
//       //   let check = HandleUntiLoadMessage(Number(req.body.adminId), Number(req.body.conversationId));
//       //   if (!check) {
//       //     return res.status(200).json(createError(200, "Spam"));
//       //   }
//       // }
//       let dataUserSend = [];
//       if (countMess && countMess.length && (countMess.length > 0) && countMess[0]._id) {
//         countMessReturn = countMess[0].count;
//         let sizeListMess = countMess[0].count - 1;
//         if (sizeListMess < 0) {
//           sizeListMess = 0;
//         }
//         let start = sizeListMess - listMess - 15;
//         if (start < 0) {
//           start = 0;
//         };
//         let conversation;
//         if (req.body.startDay && req.body.endDay) {
//           conversation = [];
//           let conversationFirst = await Conversation.aggregate([
//             {
//               $match:
//               {
//                 _id: Number(req.body.conversationId)
//               }
//             },
//             { $limit: 1 },
//             {
//               $project: {
//                 messageList: {
//                   $filter: {
//                     input: "$messageList",
//                     cond: {
//                       $and: [
//                         { $gte: ["$$messagelist.createAt", new Date(req.body.startDay)] },
//                         { $lt: ["$$messagelist.createAt", new Date(req.body.endDay)] }
//                       ]
//                     },
//                     as: "messagelist",
//                   }
//                 },
//                 favoriteMessage: 1,
//                 "memberList.memberId": 1,
//                 "memberList.lastMessageSeen": 1,
//                 "memberList.timeLastSeener": 1,
//                 "memberList.deleteTime": 1
//               }
//             }
//           ]);

//           let obj = {};
//           obj.favoriteMessage = conversationFirst[0].favoriteMessage || "";
//           obj.memberList = conversationFirst[0].memberList;
//           let lengthArr = conversationFirst[0].messageList.length;
//           let startTake = lengthArr - listMess - 30;
//           let endTake = startTake + 30;
//           if (endTake > lengthArr) {
//             endTake = lengthArr;
//           }
//           if (startTake < 0) {
//             startTake = 0;
//           };

//           if (req.body.fromHead) {
//             startTake = listMess;
//             endTake = startTake + 30;
//           }

//           obj.messageList = conversationFirst[0].messageList.slice(startTake, endTake);
//           let arr_userId = [];
//           for (let i = 0; i < obj.messageList.length; i++) {
//             if (!arr_userId.includes(obj.messageList[i].senderId)) {
//               arr_userId.push(obj.messageList[i].senderId);
//             }
//           }
//           dataUserSend = await User.find({ _id: { $in: arr_userId } }, { _id: 1, userName: 1 }).lean()
//           conversation.push(obj);
//           countMessReturn = conversationFirst[0].messageList.length;
//         }
//         else {
//           conversation = await Conversation.find(
//             { _id: Number(req.body.conversationId) },
//             {
//               messageList: { $slice: [start, 16] },
//               "memberList.favoriteMessage": 1,
//               "memberList.memberId": 1,
//               "memberList.lastMessageSeen": 1,
//               "memberList.timeLastSeener": 1,
//               "memberList.deleteTime": 1
//             }
//           ).lean()
//         }

//         if (conversation) {
//           if (conversation.length > 0) {
//             let ListMessFavour = [];
//             if (req.body.adminId && (!isNaN(req.body.adminId))) {
//               if (conversation[0].memberList && conversation[0].memberList.length && (conversation[0].memberList.length > 0) && (conversation[0].memberList.findIndex((e) => e.memberId == Number(req.body.adminId)) != -1)) {
//                 let memberInfor = conversation[0].memberList.find((e) => e.memberId == Number(req.body.adminId));
//                 if (memberInfor && memberInfor.memberId) {
//                   ListMessFavour = memberInfor.favoriteMessage || [];
//                 }
//               }
//             }

//             let ListMessFinal = [];
//             let ListMes = conversation[0].messageList;
//             let listMember = conversation[0].memberList;
//             for (let i = 0; i < ListMes.length; i++) {
//               if (ListMes[i]._id && ListMes[i].senderId && ListMes[i].messageType) {
//                 let a = {};
//                 a.messageID = ListMes[i]._id;
//                 a.conversationID = Number(req.body.conversationId);
//                 a.displayMessage = ListMes[i].displayMessage || 0;
//                 a.senderID = ListMes[i].senderId;
//                 a.messageType = ListMes[i].messageType;
//                 a.message = ListMes[i].message || "";
//                 a.uscid = ListMes[i].uscid || "";
//                 a.listDeleteUser = ListMes[i].listDeleteUser
//                 a.isSecret = ListMes[i].isSecret || 0;
//                 if (ListMes[i].quoteMessage && (ListMes[i].quoteMessage.trim() != "")) {
//                   let conversationTakeMessage = await Conversation.aggregate([
//                     {
//                       $match:
//                       {
//                         "messageList._id": ListMes[i].quoteMessage
//                       }
//                     },
//                     {
//                       $project: {
//                         messageList: {
//                           $slice: [
//                             {
//                               $filter: {
//                                 input: "$messageList",
//                                 as: "messagelist",
//                                 cond: {
//                                   $eq: ["$$messagelist._id", ListMes[i].quoteMessage]
//                                 },
//                               }
//                             },
//                             -1
//                           ]
//                         }
//                       }
//                     }
//                   ])
//                   if (conversationTakeMessage && conversationTakeMessage.length > 0 && conversationTakeMessage[0].messageList && conversationTakeMessage[0].messageList.length && (conversationTakeMessage[0].messageList.length > 0)) {
//                     let message = conversationTakeMessage[0].messageList[0];
//                     let senderData = await User.findOne({ _id: message.senderId }, { userName: 1 })
//                     if (senderData && senderData.userName && message._id && message.senderId && message.createAt) {
//                       a.quoteMessage = fMessageQuote(message._id, senderData.userName, message.senderId, message.messageType || "text", message.message, message.createAt)
//                     }
//                     else {
//                       a.quoteMessage = null;
//                     }
//                   }
//                   else {
//                     a.quoteMessage = fMessageQuote(ListMes[i].quoteMessage, "", -1, "text", "", `${JSON.parse(JSON.stringify(new Date(ListMes[i].createAt.setHours(ListMes[i].createAt.getHours() + 7)))).replace("Z", "")}+07:00`)
//                   }
//                 }
//                 else {
//                   a.quoteMessage = null;
//                 }
//                 a.messageQuote = ListMes[i].messageQuote || "";
//                 a.createAt = `${JSON.parse(JSON.stringify(new Date(ListMes[i].createAt.setHours(ListMes[i].createAt.getHours() + 7)))).replace("Z", "")}+07:00`;
//                 a.isEdited = ListMes[i].isEdited || 0;
//                 if (ListMes[i].infoLink) {
//                   a.infoLink = fInfoLink(ListMes[i]._id, ListMes[i].infoLink.title, ListMes[i].infoLink.description, ListMes[i].infoLink.linkHome, ListMes[i].infoLink.image, ListMes[i].infoLink.isNotification);
//                 }
//                 else {
//                   a.infoLink = null;
//                 }
//                 if (ListMes[i].listFile && ListMes[i].listFile.length && (ListMes[i].listFile.length > 0)) {
//                   let listFileFirst = [];
//                   for (let j = 0; j < ListMes[i].listFile.length; j++) {
//                     listFileFirst.push(
//                       fInfoFile(
//                         ListMes[i].listFile[j].messageType || "",
//                         ListMes[i].listFile[j].nameFile || "",
//                         ListMes[i].listFile[j].sizeFile || 0,
//                         ListMes[i].listFile[j].height || 0,
//                         ListMes[i].listFile[j].width || 0
//                       ));
//                   }
//                   a.listFile = listFileFirst;
//                 }
//                 else {
//                   a.listFile = [];
//                 }
//                 if (ListMes[i].localFile && ListMes[i].localFile.length && (ListMes[i].localFile.length > 0)) {
//                   let localFileFirst = [];
//                   for (let j = 0; j < ListMes[i].localFile.length; j++) {
//                     localFileFirst.push(
//                       localfile(
//                         ListMes[i].localFile[j].IdDevice || "",
//                         ListMes[i].localFile[j].pathFile || ""
//                       )

//                     );
//                   }
//                   a.localFile = localFileFirst;
//                 }
//                 else {
//                   a.localFile = [];
//                 }
//                 if (a.messageType == "sendCv") {
//                   for (let j = 0; j < a.listFile.length; j++) {
//                     if (a.listFile[j].fullName.split(".")[a.listFile[j].fullName.split(".").length - 1] == "pdf") {
//                       a.linkPdf = `https://ht.timviec365.vn:9002/uploads/${a.listFile[j].fullName}`;
//                     }
//                     else if (a.listFile[j].fullName.split(".")[a.listFile[j].fullName.split(".").length - 1] == "png") {
//                       a.linkPng = `https://ht.timviec365.vn:9002/uploads/${a.listFile[j].fullName}`;
//                     }
//                   }
//                 }
//                 a.emotionMessage = [];
//                 if (ListMes[i].emotion) {
//                   if (ListMes[i].emotion.Emotion1 && (String(ListMes[i].emotion.Emotion1).trim() != "")) {
//                     a.emotionMessage.push(fEmotion(1, ListMes[i].emotion.Emotion1.split(","), `${urlImgHost()}Emotion/Emotion1.png`))
//                   }
//                   if (ListMes[i].emotion.Emotion2 && (String(ListMes[i].emotion.Emotion2).trim() != "")) {
//                     a.emotionMessage.push(fEmotion(2, ListMes[i].emotion.Emotion2.split(","), `${urlImgHost()}Emotion/Emotion2.png`))
//                   }
//                   if (ListMes[i].emotion.Emotion3 && (String(ListMes[i].emotion.Emotion3).trim() != "")) {
//                     a.emotionMessage.push(fEmotion(3, ListMes[i].emotion.Emotion3.split(","), `${urlImgHost()}Emotion/Emotion3.png`))
//                   }
//                   if (ListMes[i].emotion.Emotion4 && (String(ListMes[i].emotion.Emotion4).trim() != "")) {
//                     a.emotionMessage.push(fEmotion(4, ListMes[i].emotion.Emotion4.split(","), `${urlImgHost()}Emotion/Emotion4.png`))
//                   }
//                   if (ListMes[i].emotion.Emotion5 && (String(ListMes[i].emotion.Emotion5).trim() != "")) {
//                     a.emotionMessage.push(fEmotion(5, ListMes[i].emotion.Emotion5.split(","), `${urlImgHost()}Emotion/Emotion5.png`))
//                   }
//                   if (ListMes[i].emotion.Emotion6 && (String(ListMes[i].emotion.Emotion6).trim() != "")) {
//                     a.emotionMessage.push(fEmotion(6, ListMes[i].emotion.Emotion6.split(","), `${urlImgHost()}Emotion/Emotion6.png`))
//                   }
//                   if (ListMes[i].emotion.Emotion7 && (String(ListMes[i].emotion.Emotion7).trim() != "")) {
//                     a.emotionMessage.push(fEmotion(7, ListMes[i].emotion.Emotion7.split(","), `${urlImgHost()}Emotion/Emotion7.png`))
//                   }
//                   if (ListMes[i].emotion.Emotion8 && (String(ListMes[i].emotion.Emotion8).trim() != "")) {
//                     a.emotionMessage.push(fEmotion(8, ListMes[i].emotion.Emotion8.split(","), `${urlImgHost()}Emotion/Emotion8.png`))
//                   }
//                 }
//                 else {
//                   a.emotion = ListMes[i].emotion || {};
//                   a.emotionMessage = [];
//                 }
//                 if (ListMes[i].messageType == "sendProfile") {
//                   if (!isNaN(ListMes[i].message)) {
//                     let userData = await User.findOne({ _id: ListMes[i].message });
//                     if (userData && userData.userName) {
//                       let b = {};
//                       b.iD365 = userData.id365;
//                       b.idTimViec = userData.idTimViec;
//                       b.type365 = userData.type365;
//                       b.password = "";
//                       b.phone = userData.phone;
//                       b.notificationPayoff = 0;
//                       b.notificationCalendar = 1;
//                       b.notificationReport = 1;
//                       b.notificationOffer = 1;
//                       b.notificationPersonnelChange = 1;
//                       b.notificationRewardDiscipline = userData.notificationRewardDiscipline;
//                       b.notificationNewPersonnel = userData.notificationNewPersonnel;
//                       b.notificationChangeProfile = userData.notificationChangeProfile;
//                       b.notificationTransferAsset = userData.notificationTransferAsset;
//                       b.acceptMessStranger = userData.acceptMessStranger;
//                       b.type_Pass = 0;
//                       b.companyName = userData.companyName;
//                       b.secretCode = "";
//                       b.notificationMissMessage = 0;
//                       b.notificationCommentFromTimViec = 0;
//                       b.notificationCommentFromRaoNhanh = 0;
//                       b.notificationTag = 0;
//                       b.notificationSendCandidate = 0;
//                       b.notificationChangeSalary = 0;
//                       b.notificationAllocationRecall = 0;
//                       b.notificationAcceptOffer = 0;
//                       b.notificationDecilineOffer = 0;
//                       b.notificationNTDPoint = 0;
//                       b.notificationNTDExpiredPin = 0;
//                       b.notificationNTDExpiredRecruit = 0;
//                       b.fromWeb = userData.fromWeb;
//                       b.notificationNTDApplying = 0;
//                       b.userQr = null;
//                       b.id = userData._id;
//                       b.email = userData.email;
//                       b.userName = userData.userName;
//                       b.avatarUser = userData.avatarUser;
//                       b.status = userData.status;
//                       b.active = userData.active;
//                       b.isOnline = userData.isOnline;
//                       b.looker = userData.looker;
//                       b.statusEmotion = userData.statusEmotion;
//                       b.lastActive = userData.lastActive;

//                       if (String(userData.avatarUser).trim != "") {
//                         b.linkAvatar = `${urlImgHost()}avatarUser/${userData._id}/${userData.avatarUser}`;
//                       }
//                       else {
//                         b.linkAvatar = `${urlImgHost()}avatar/${userData.userName[0]}_${getRandomInt(1, 4)}.png`
//                       }
//                       b.companyId = userData.companyId;

//                       let status = await RequestContact.findOne({
//                         $or: [
//                           { userId: Number(req.body.adminId), contactId: userData._id },
//                           { userId: userData._id, contactId: Number(req.body.adminId) }
//                         ]
//                       }).lean();
//                       if (status) {
//                         if (status.status == "accept") {
//                           b.friendStatus = "friend";
//                         }
//                         else {
//                           b.friendStatus = status.status;
//                         }
//                       }
//                       else {
//                         b.friendStatus = "none";
//                       }
//                       a.userProfile = b;
//                     }
//                     else {
//                       a.userProfile = null;
//                     }
//                   }

//                 }
//                 else {
//                   a.userProfile = null;
//                 }
//                 a.listTag = null;
//                 a.link = ListMes[i]?.infoLink?.linkHome;
//                 a.linkNotification = ListMes[i]?.infoLink?.linkHome
//                 a.file = a.listFile;
//                 a.quote = null;
//                 a.profile = a.userProfile;
//                 a.deleteTime = ListMes[i].deleteTime;
//                 a.deleteType = ListMes[i].deleteType;
//                 if (a.isSecret == 1) {
//                   a.deleteType = 1;
//                 }
//                 a.deleteDate = String('0001-01-01T00:00:00.000+00:00');
//                 a.infoSupport = ListMes[i].infoSupport;
//                 a.liveChat = ListMes[i].liveChat;
//                 a.isClicked = ListMes[i].isClicked || 0;
//                 a.inforSeen = [];
//                 for (let j = 0; j < listMember.length; j++) {
//                   if (a.messageID == listMember[j].lastMessageSeen) {
//                     a.inforSeen.push({
//                       memberId: listMember[j].memberId,
//                       seenTime: listMember[j].timeLastSeener
//                     })
//                   }
//                 }
//                 if (ListMes[i] && ListMes[i].notiClicked) {
//                   if (ListMes[i].notiClicked.includes(Number(req.body.adminId))) {
//                     a.isClicked = 1;
//                   }
//                 }
//                 if (ListMessFavour && ListMessFavour.includes(ListMes[i]._id)) {
//                   a.IsFavorite = 1;
//                 }
//                 else {
//                   a.IsFavorite = 0;
//                 }

//                 //if (ListMes[i].messageType == "OfferReceive" || ListMes[i].messageType == "applying") {
//                 //if (ListMes[i + 1]) {
//                 //a.linkNotification = ListMes[i + 1].message || "";
//                 //a.infoLink = fInfoLink(ListMes[i + 1]._id, ListMes[i + 1].infoLink.title, ListMes[i + 1].infoLink.description, ListMes[i + 1].infoLink.linkHome, ListMes[i + 1].infoLink.image, ListMes[i + 1].infoLink.isNotification);
//                 //}
//                 //}
//                 let flagPushMessage = true;
//                 if (i > 0) {
//                   if (ListMes[i - 1] && ListMes[i] && ListMes[i - 1].messageType && ListMes[i].messageType) {
//                     if (ListMes[i - 1].messageType == "OfferReceive") {
//                       if (ListMes[i].messageType == "link") {
//                         flagPushMessage = true;
//                       }
//                     }
//                     else if (ListMes[i - 1].messageType == "applying") {
//                       if (ListMes[i].messageType == "link") {
//                         flagPushMessage = true;
//                       }
//                     }
//                   }
//                 }
//                 if (ListMes[i].isEdited == 2) {
//                   if (ListMes[i].listDeleteUser && req.body.adminId && ListMes[i].listDeleteUser.length && ListMes[i].listDeleteUser.find((e) => e == Number(req.body.adminId))) {
//                     flagPushMessage = false
//                   }
//                 }
//                 if (ListMes[i].infoSupport) {
//                   if (ListMes[i].infoSupport.status) {
//                     if (ListMes[i].infoSupport.status == 1) {
//                       let b = "k add"
//                     }
//                     else {
//                       if (flagPushMessage) {
//                         ListMessFinal.push(a)
//                       }
//                     }
//                   }
//                   else {
//                     if (flagPushMessage) {
//                       ListMessFinal.push(a)
//                     }
//                   }
//                 }
//                 else {
//                   if (flagPushMessage) {
//                     ListMessFinal.push(a)
//                   }
//                 }
//               }
//             }
//             res.json({
//               data: {
//                 result: true,
//                 messsage: "Lấy danh sách tin nhắn thành công",
//                 countMessage: countMessReturn,
//                 message_info: null,
//                 listMessages: ListMessFinal,
//                 dataUserSend
//               },
//               error: null
//             })
//           }
//           else {
//             res.json({
//               data: {
//                 result: true,
//                 messsage: "Lấy danh sách tin nhắn thành công",
//                 countMessage: 0,
//                 message_info: null,
//                 listMessages: []
//               },
//               error: null
//             })
//           }
//         }
//       }
//       else {
//         res.json({
//           data: {
//             result: true,
//             messsage: "Lấy danh sách tin nhắn thành công",
//             countMessage: 0,
//             message_info: null,
//             listMessages: []
//           },
//           error: null
//         })
//       }
//     }
//     else {
//       res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
//     }
//   }
//   catch (e) {
//     console.log(e);
//     res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
//   }
// }

export const LoadMessage = async (req, res, next) => {
  try {
    console.log(req.body);
    if (req.body.adminId == 354005) { return "leuleu" }
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status) {
        console.log("Token hop le, LoadMessage")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body && req.body.conversationId && (!isNaN(req.body.conversationId)) && Number(req.body.conversationId)) {
      let countMess = await Conversation.aggregate([
        { $match: { _id: Number(req.body.conversationId) } },
        { $project: { count: { $size: "$messageList" } } }
      ]);
      let countMessReturn;
      let listMess = Number(req.body.listMess) || 0;
      if (listMess == 0) {
        let check = HandleUntiLoadMessage(Number(req.body.adminId), Number(req.body.conversationId));
        if (!check) {
          return res.status(200).json(createError(200, "Spam"));
        }
      }
      let dataUserSend = [];
      if (countMess && countMess.length && (countMess.length > 0) && countMess[0]._id) {
        countMessReturn = countMess[0].count;
        let sizeListMess = countMess[0].count - 1;
        if (sizeListMess < 0) {
          sizeListMess = 0;
        }
        let start = sizeListMess - listMess - 8;
        if (start < 0) {
          start = 0;
        };
        let conversation;
        if (req.body.startDay && req.body.endDay) {
          conversation = [];
          let conversationFirst = await Conversation.aggregate([
            {
              '$match': {
                '_id': Number(req.body.conversationId)
              }
            }, {
              '$project': {
                'messageList1': '$messageList',
                'messageList': {
                  $filter: {
                    input: "$messageList",
                    cond: {
                      $and: [
                        { $gte: ["$$messagelist.createAt", new Date(req.body.startDay)] },
                        { $lt: ["$$messagelist.createAt", new Date(req.body.endDay)] }
                      ]
                    },
                    as: "messagelist",
                  }
                },
                'memberList.favoriteMessage': 1,
                'memberList.memberId': 1,
                'memberList.lastMessageSeen': 1,
                'memberList.timeLastSeener': 1,
                'memberList.deleteTime': 1
              }
            }, {
              '$unwind': {
                'path': '$messageList'
              }
            }, {
              '$project': {
                'message': {
                  '$filter': {
                    'input': '$messageList1',
                    'as': 'messagelist1',
                    'cond': {
                      '$eq': [
                        '$$messagelist1._id', '$messageList.quoteMessage'
                      ]
                    }
                  }
                },
                'memberList': 1,
                'messageList': 1
              }
            }, {
              '$unwind': {
                'path': '$message',
                'preserveNullAndEmptyArrays': true
              }
            }, {
              '$lookup': {
                'from': 'Users',
                'localField': 'message.senderId',
                'foreignField': '_id',
                'as': 'user'
              }
            }, {
              '$unwind': {
                'path': '$user',
                'preserveNullAndEmptyArrays': true
              }
            }, {
              '$addFields': {
                'messageList.quoteMessage': {
                  '_id': '$message._id',
                  'userName': '$user.userName',
                  'senderId': '$message.senderId',
                  'messageType': '$message.messageType',
                  'message': '$message.message',
                  'createAt': '$message.createAt'
                }
              }
            }, {
              '$unset': 'message'
            }, {
              '$unset': 'user'
            }
          ])

          let obj = {};
          obj.favoriteMessage = conversationFirst[0].favoriteMessage || "";
          obj.memberList = conversationFirst[0].memberList;
          let lengthArr = conversationFirst.length;
          let startTake = lengthArr - listMess - 30;
          let endTake = startTake + 30;
          if (endTake > lengthArr) {
            endTake = lengthArr;
          }
          if (startTake < 0) {
            startTake = 0;
          };

          if (req.body.fromHead) {
            startTake = listMess;
            endTake = startTake + 30;
          }

          obj.messageList = []
          for (let i = startTake; i < endTake; i++) {
            obj.messageList.push(conversationFirst[i].messageList)
          }
          let arr_userId = [];
          for (let i = 0; i < obj.messageList.length; i++) {
            if (!arr_userId.includes(obj.messageList[i].senderId)) {
              arr_userId.push(obj.messageList[i].senderId);
            }
          }
          dataUserSend = await User.find({ _id: { $in: arr_userId } }, { _id: 1, userName: 1 }).lean()
          conversation.push(obj);
          countMessReturn = conversationFirst[0].messageList.length;
        }
        else {
          conversation = await Conversation.aggregate([
            {
              '$match': {
                '_id': Number(req.body.conversationId)
              }
            }, {
              '$project': {
                'messageList': {
                  '$slice': [
                    '$messageList', start, 16
                  ]
                },
                'memberList.favoriteMessage': 1,
                'memberList.memberId': 1,
                'memberList.lastMessageSeen': 1,
                'memberList.timeLastSeener': 1,
                'memberList.deleteTime': 1
              }
            }, {
              '$unwind': {
                'path': '$messageList'
              }
            }, {
              '$lookup': {
                'from': 'Conversations',
                'localField': 'messageList.quoteMessage',
                'foreignField': 'messageList._id',
                'as': 'con'
              }
            }, {
              '$unwind': {
                'path': '$con',
                'preserveNullAndEmptyArrays': true
              }
            }, {
              '$addFields': {
                'message': {
                  '$filter': {
                    'input': '$con.messageList',
                    'as': 'messagelist1',
                    'cond': {
                      '$eq': [
                        '$$messagelist1._id', '$messageList.quoteMessage'
                      ]
                    }
                  }
                }
              }
            }, {
              '$unset': 'con'
            }, {
              '$unwind': {
                'path': '$message',
                'preserveNullAndEmptyArrays': true
              }
            }, {
              '$unwind': {
                'path': '$message',
                'preserveNullAndEmptyArrays': true
              }
            }, {
              '$lookup': {
                'from': 'Users',
                'localField': 'message.senderId',
                'foreignField': '_id',
                'as': 'user'
              }
            }, {
              '$unwind': {
                'path': '$user',
                'preserveNullAndEmptyArrays': true
              }
            }, {
              '$addFields': {
                'messageList.quoteMessage': {
                  '_id': '$message._id',
                  'userName': '$user.userName',
                  'senderId': '$message.senderId',
                  'messageType': '$message.messageType',
                  'message': '$message.message',
                  'createAt': '$message.createAt'
                }
              }
            }, {
              '$unset': 'message'
            }, {
              '$unset': 'user'
            }
          ])
        }

        if (conversation) {
          if (conversation.length > 0) {
            let ListMessFavour = [];
            if (req.body.adminId && (!isNaN(req.body.adminId))) {
              if (conversation[0].memberList && conversation[0].memberList.length && (conversation[0].memberList.length > 0) && (conversation[0].memberList.findIndex((e) => e.memberId == Number(req.body.adminId)) != -1)) {
                let memberInfor = conversation[0].memberList.find((e) => e.memberId == Number(req.body.adminId));
                if (memberInfor && memberInfor.memberId) {
                  ListMessFavour = memberInfor.favoriteMessage || [];
                }
              }
            }

            let ListMessFinal = [];
            let listMember = conversation[0].memberList;
            for (let i = 0; i < conversation.length; i++) {
              if (conversation[i].messageList._id && conversation[i].messageList.senderId && conversation[i].messageList.messageType) {
                let a = {};
                a.messageID = conversation[i].messageList._id;
                a.conversationID = Number(req.body.conversationId);
                a.displayMessage = conversation[i].messageList.displayMessage || 0;
                a.senderID = conversation[i].messageList.senderId;
                a.messageType = conversation[i].messageList.messageType;
                a.message = conversation[i].messageList.message || "";
                a.uscid = conversation[i].messageList.uscid || "";
                a.listDeleteUser = conversation[i].messageList.listDeleteUser
                a.isSecret = conversation[i].messageList.isSecret || 0;
                if (conversation[i].messageList.quoteMessage && conversation[i].messageList.quoteMessage._id) {
                  a.quoteMessage = fMessageQuote(conversation[i].messageList.quoteMessage._id, conversation[i].messageList.quoteMessage.userName, conversation[i].messageList.quoteMessage.senderId, conversation[i].messageList.quoteMessage.messageType, conversation[i].messageList.quoteMessage.message, conversation[i].messageList.quoteMessage.createAt)
                }
                else {
                  a.quoteMessage = null;
                }
                a.messageQuote = conversation[i].messageList.messageQuote || "";
                a.createAt = `${JSON.parse(JSON.stringify(new Date(conversation[i].messageList.createAt.setHours(conversation[i].messageList.createAt.getHours() + 7)))).replace("Z", "")}+07:00`;
                a.isEdited = conversation[i].messageList.isEdited || 0;
                if (conversation[i].messageList.infoLink) {
                  a.infoLink = fInfoLink(conversation[i].messageList._id, conversation[i].messageList.infoLink.title, conversation[i].messageList.infoLink.description, conversation[i].messageList.infoLink.linkHome, conversation[i].messageList.infoLink.image, conversation[i].messageList.infoLink.isNotification);
                }
                else {
                  a.infoLink = null;
                }
                if (conversation[i].messageList.listFile && conversation[i].messageList.listFile.length && (conversation[i].messageList.listFile.length > 0)) {
                  let listFileFirst = [];
                  for (let j = 0; j < conversation[i].messageList.listFile.length; j++) {
                    listFileFirst.push(
                      fInfoFile(
                        conversation[i].messageList.listFile[j].messageType || "",
                        conversation[i].messageList.listFile[j].nameFile || "",
                        conversation[i].messageList.listFile[j].sizeFile || 0,
                        conversation[i].messageList.listFile[j].height || 0,
                        conversation[i].messageList.listFile[j].width || 0,
                        conversation[i].messageList.listFile[j].origin || ""
                      ));
                  }
                  a.listFile = listFileFirst;
                }
                else {
                  a.listFile = [];
                }
                if (conversation[i].messageList.localFile && conversation[i].messageList.localFile.length && (conversation[i].messageList.localFile.length > 0)) {
                  let localFileFirst = [];
                  for (let j = 0; j < conversation[i].messageList.localFile.length; j++) {
                    localFileFirst.push(
                      localfile(
                        conversation[i].messageList.localFile[j].IdDevice || "",
                        conversation[i].messageList.localFile[j].pathFile || ""
                      )

                    );
                  }
                  a.localFile = localFileFirst;
                }
                else {
                  a.localFile = [];
                }
                if (a.messageType == "sendCv") {
                  for (let j = 0; j < a.listFile.length; j++) {
                    if (a.listFile[j].fullName.split(".")[a.listFile[j].fullName.split(".").length - 1] == "pdf") {
                      a.linkPdf = `https://ht.timviec365.vn:9002/uploads/${a.listFile[j].fullName}`;
                    }
                    else if (a.listFile[j].fullName.split(".")[a.listFile[j].fullName.split(".").length - 1] == "png") {
                      a.linkPng = `https://ht.timviec365.vn:9002/uploads/${a.listFile[j].fullName}`;
                    }
                  }
                }
                a.emotionMessage = [];
                if (conversation[i].messageList.emotion) {
                  if (conversation[i].messageList.emotion.Emotion1 && (String(conversation[i].messageList.emotion.Emotion1).trim() != "")) {
                    a.emotionMessage.push(fEmotion(1, conversation[i].messageList.emotion.Emotion1.split(","), `${urlImgHost()}Emotion/Emotion1.png`))
                  }
                  if (conversation[i].messageList.emotion.Emotion2 && (String(conversation[i].messageList.emotion.Emotion2).trim() != "")) {
                    a.emotionMessage.push(fEmotion(2, conversation[i].messageList.emotion.Emotion2.split(","), `${urlImgHost()}Emotion/Emotion2.png`))
                  }
                  if (conversation[i].messageList.emotion.Emotion3 && (String(conversation[i].messageList.emotion.Emotion3).trim() != "")) {
                    a.emotionMessage.push(fEmotion(3, conversation[i].messageList.emotion.Emotion3.split(","), `${urlImgHost()}Emotion/Emotion3.png`))
                  }
                  if (conversation[i].messageList.emotion.Emotion4 && (String(conversation[i].messageList.emotion.Emotion4).trim() != "")) {
                    a.emotionMessage.push(fEmotion(4, conversation[i].messageList.emotion.Emotion4.split(","), `${urlImgHost()}Emotion/Emotion4.png`))
                  }
                  if (conversation[i].messageList.emotion.Emotion5 && (String(conversation[i].messageList.emotion.Emotion5).trim() != "")) {
                    a.emotionMessage.push(fEmotion(5, conversation[i].messageList.emotion.Emotion5.split(","), `${urlImgHost()}Emotion/Emotion5.png`))
                  }
                  if (conversation[i].messageList.emotion.Emotion6 && (String(conversation[i].messageList.emotion.Emotion6).trim() != "")) {
                    a.emotionMessage.push(fEmotion(6, conversation[i].messageList.emotion.Emotion6.split(","), `${urlImgHost()}Emotion/Emotion6.png`))
                  }
                  if (conversation[i].messageList.emotion.Emotion7 && (String(conversation[i].messageList.emotion.Emotion7).trim() != "")) {
                    a.emotionMessage.push(fEmotion(7, conversation[i].messageList.emotion.Emotion7.split(","), `${urlImgHost()}Emotion/Emotion7.png`))
                  }
                  if (conversation[i].messageList.emotion.Emotion8 && (String(conversation[i].messageList.emotion.Emotion8).trim() != "")) {
                    a.emotionMessage.push(fEmotion(8, conversation[i].messageList.emotion.Emotion8.split(","), `${urlImgHost()}Emotion/Emotion8.png`))
                  }
                }
                else {
                  a.emotion = conversation[i].messageList.emotion || {};
                  a.emotionMessage = [];
                }
                if (conversation[i].messageList.messageType == "sendProfile") {
                  if (!isNaN(conversation[i].messageList.message)) {
                    let userData = await User.findOne({ _id: conversation[i].messageList.message });
                    if (userData && userData.userName) {
                      let b = {};
                      b.iD365 = userData.id365;
                      b.idTimViec = userData.idTimViec;
                      b.type365 = userData.type365;
                      b.password = "";
                      b.phone = userData.phone;
                      b.notificationPayoff = 0;
                      b.notificationCalendar = 1;
                      b.notificationReport = 1;
                      b.notificationOffer = 1;
                      b.notificationPersonnelChange = 1;
                      b.notificationRewardDiscipline = userData.notificationRewardDiscipline;
                      b.notificationNewPersonnel = userData.notificationNewPersonnel;
                      b.notificationChangeProfile = userData.notificationChangeProfile;
                      b.notificationTransferAsset = userData.notificationTransferAsset;
                      b.acceptMessStranger = userData.acceptMessStranger;
                      b.type_Pass = 0;
                      b.companyName = userData.companyName;
                      b.secretCode = "";
                      b.notificationMissMessage = 0;
                      b.notificationCommentFromTimViec = 0;
                      b.notificationCommentFromRaoNhanh = 0;
                      b.notificationTag = 0;
                      b.notificationSendCandidate = 0;
                      b.notificationChangeSalary = 0;
                      b.notificationAllocationRecall = 0;
                      b.notificationAcceptOffer = 0;
                      b.notificationDecilineOffer = 0;
                      b.notificationNTDPoint = 0;
                      b.notificationNTDExpiredPin = 0;
                      b.notificationNTDExpiredRecruit = 0;
                      b.fromWeb = userData.fromWeb;
                      b.notificationNTDApplying = 0;
                      b.userQr = null;
                      b.id = userData._id;
                      b.email = userData.email;
                      b.userName = userData.userName;
                      b.avatarUser = userData.avatarUser;
                      b.status = userData.status;
                      b.active = userData.active;
                      b.isOnline = userData.isOnline;
                      b.looker = userData.looker;
                      b.statusEmotion = userData.statusEmotion;
                      b.lastActive = userData.lastActive;

                      if (String(userData.avatarUser).trim != "") {
                        b.linkAvatar = `${urlImgHost()}avatarUser/${userData._id}/${userData.avatarUser}`;
                      }
                      else {
                        b.linkAvatar = `${urlImgHost()}avatar/${userData.userName[0]}_${getRandomInt(1, 4)}.png`
                      }
                      b.companyId = userData.companyId;

                      let status = await RequestContact.findOne({
                        $or: [
                          { userId: Number(req.body.adminId), contactId: userData._id },
                          { userId: userData._id, contactId: Number(req.body.adminId) }
                        ]
                      }).lean();
                      if (status) {
                        if (status.status == "accept") {
                          b.friendStatus = "friend";
                        }
                        else {
                          b.friendStatus = status.status;
                        }
                      }
                      else {
                        b.friendStatus = "none";
                      }
                      a.userProfile = b;
                    }
                    else {
                      a.userProfile = null;
                    }
                  }

                }
                else {
                  a.userProfile = null;
                }
                a.listTag = null;
                a.link = conversation[i].messageList?.infoLink?.linkHome;
                a.linkNotification = conversation[i].messageList?.infoLink?.linkHome
                a.file = a.listFile;
                a.quote = null;
                a.profile = a.userProfile;
                a.deleteTime = conversation[i].messageList.deleteTime;
                a.deleteType = conversation[i].messageList.deleteType;
                if (a.isSecret == 1) {
                  a.deleteType = 1;
                }
                a.deleteDate = String('0001-01-01T00:00:00.000+00:00');
                a.infoSupport = conversation[i].messageList.infoSupport;
                a.liveChat = conversation[i].messageList.liveChat;
                a.isClicked = conversation[i].messageList.isClicked || 0;
                a.inforSeen = [];
                for (let j = 0; j < listMember.length; j++) {
                  if (a.messageID == listMember[j].lastMessageSeen) {
                    a.inforSeen.push({
                      memberId: listMember[j].memberId,
                      seenTime: listMember[j].timeLastSeener
                    })
                  }
                }
                if (conversation[i].messageList && conversation[i].messageList.notiClicked) {
                  if (conversation[i].messageList.notiClicked.includes(Number(req.body.adminId))) {
                    a.isClicked = 1;
                  }
                }
                if (ListMessFavour && ListMessFavour.includes(conversation[i].messageList._id)) {
                  a.IsFavorite = 1;
                }
                else {
                  a.IsFavorite = 0;
                }

                //if (conversation[i].messageList.messageType == "OfferReceive" || conversation[i].messageList.messageType == "applying") {
                //if (ListMes[i + 1]) {
                //a.linkNotification = ListMes[i + 1].message || "";
                //a.infoLink = fInfoLink(ListMes[i + 1]._id, ListMes[i + 1].infoLink.title, ListMes[i + 1].infoLink.description, ListMes[i + 1].infoLink.linkHome, ListMes[i + 1].infoLink.image, ListMes[i + 1].infoLink.isNotification);
                //}
                //}
                let flagPushMessage = true;
                if (i > 0) {
                  if (conversation[i - 1].messageList && conversation[i].messageList && conversation[i - 1].messageList.messageType && conversation[i].messageList.messageType) {
                    if (conversation[i - 1].messageList.messageType == "OfferReceive") {
                      if (conversation[i].messageList.messageType == "link") {
                        flagPushMessage = true;
                      }
                    }
                    else if (conversation[i - 1].messageList.messageType == "applying") {
                      if (conversation[i].messageList.messageType == "link") {
                        flagPushMessage = true;
                      }
                    }
                  }
                }
                if (conversation[i].messageList.isEdited == 2) {
                  if (conversation[i].messageList.listDeleteUser && req.body.adminId && conversation[i].messageList.listDeleteUser.length && conversation[i].messageList.listDeleteUser.find((e) => e == Number(req.body.adminId))) {
                    flagPushMessage = false
                  }
                }
                if (conversation[i].messageList.infoSupport) {
                  if (conversation[i].messageList.infoSupport.status) {
                    if (conversation[i].messageList.infoSupport.status == 1) {
                      let b = "k add"
                    }
                    else {
                      if (flagPushMessage) {
                        ListMessFinal.push(a)
                      }
                    }
                  }
                  else {
                    if (flagPushMessage) {
                      ListMessFinal.push(a)
                    }
                  }
                }
                else {
                  if (flagPushMessage) {
                    ListMessFinal.push(a)
                  }
                }
              }
            }
            res.json({
              data: {
                result: true,
                messsage: "Lấy danh sách tin nhắn thành công",
                countMessage: countMessReturn,
                message_info: null,
                listMessages: ListMessFinal,
                dataUserSend
              },
              error: null
            })
          }
          else {
            res.json({
              data: {
                result: true,
                messsage: "Lấy danh sách tin nhắn thành công",
                countMessage: 0,
                message_info: null,
                listMessages: []
              },
              error: null
            })
          }
        }
      }
      else {
        res.json({
          data: {
            result: true,
            messsage: "Lấy danh sách tin nhắn thành công",
            countMessage: 0,
            message_info: null,
            listMessages: []
          },
          error: null
        })
      }
    }
    else {
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  }
  catch (e) {
    console.log(e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}


export const LoadListMessage = async (req, res) => {
  try {
    if (req.body.UserId && req.body.ListConvId) {
      const ListConvId = req.body.ListConvId.replace('[', '').replace(']', '').split(',')
      const UserId = Number(req.body.UserId)
      for (let i = 0; i < ListConvId.length; i++) {
        ListConvId[i] = Number(ListConvId[i])
      }
      const ListConversation = await Conversation.aggregate([
        {
          $match: {
            _id: {
              $in: ListConvId,
            },
          },
        },
        {
          $project: {
            messageList: {
              $slice: ["$messageList", -20],
            },
            memberList: "$memberList",
            countMess: {
              $size: "$messageList",
            },
          },
        },
      ])
      const result = []
      await Promise.all(
        ListConversation.map(async (conversation) => {
          let ListMessFavour = [];
          let dataUserSend = [];
          if (conversation.memberList && conversation.memberList.length && (conversation.memberList.length > 0) && (conversation.memberList.findIndex((e) => e.memberId == Number(req.body.UserId)) != -1)) {
            let memberInfor = conversation.memberList.find((e) => e.memberId == Number(req.body.UserId));
            if (memberInfor && memberInfor.memberId) {
              ListMessFavour = memberInfor.favoriteMessage || [];
            }
          }
          let ListMessFinal = [];
          let ListMes = conversation.messageList;
          for (let i = 0; i < ListMes.length; i++) {
            if (ListMes[i]._id && ListMes[i].senderId && ListMes[i].messageType) {
              let a = {};
              a.messageID = ListMes[i]._id;
              a.conversationID = Number(conversation._id);
              a.displayMessage = ListMes[i].displayMessage || 0;
              a.senderID = ListMes[i].senderId;
              a.messageType = ListMes[i].messageType;
              a.message = ListMes[i].message || "";
              a.uscid = ListMes[i].uscid || "";
              a.listDeleteUser = ListMes[i].listDeleteUser
              a.isSecret = ListMes[i].isSecret

              if (ListMes[i].quoteMessage && (ListMes[i].quoteMessage.trim() != "")) {
                let conversationTakeMessage = await Conversation.aggregate([
                  {
                    $match:
                    {
                      "messageList._id": ListMes[i].quoteMessage
                    }
                  },
                  {
                    $project: {
                      messageList: {
                        $slice: [
                          {
                            $filter: {
                              input: "$messageList",
                              as: "messagelist",
                              cond: {
                                $eq: ["$$messagelist._id", ListMes[i].quoteMessage]
                              },
                            }
                          },
                          -1
                        ]
                      }
                    }
                  }
                ])
                if (conversationTakeMessage && conversationTakeMessage.length > 0 && conversationTakeMessage[0].messageList && conversationTakeMessage[0].messageList.length && (conversationTakeMessage[0].messageList.length > 0)) {
                  let message = conversationTakeMessage[0].messageList[0];
                  let senderData = await User.findOne({ _id: message.senderId }, { userName: 1 })
                  if (senderData && senderData.userName && message._id && message.senderId && message.createAt) {
                    a.quoteMessage = fMessageQuote(message._id, senderData.userName, message.senderId, message.messageType || "text", message.message, message.createAt)
                  }
                  else {
                    a.quoteMessage = null;
                  }
                }
                else {
                  a.quoteMessage = fMessageQuote(ListMes[i].quoteMessage, "", -1, "text", "", `${JSON.parse(JSON.stringify(new Date(ListMes[i].createAt.setHours(ListMes[i].createAt.getHours() + 7)))).replace("Z", "")}+07:00`)
                }
              }
              else {
                a.quoteMessage = null;
              }
              a.messageQuote = ListMes[i].messageQuote || "";
              a.createAt = `${JSON.parse(JSON.stringify(new Date(ListMes[i].createAt.setHours(ListMes[i].createAt.getHours() + 7)))).replace("Z", "")}+07:00`;
              a.isEdited = ListMes[i].isEdited || 0;
              if (ListMes[i].infoLink) {
                a.infoLink = fInfoLink(ListMes[i]._id, ListMes[i].infoLink.title, ListMes[i].infoLink.description, ListMes[i].infoLink.linkHome, ListMes[i].infoLink.image, ListMes[i].infoLink.isNotification);
              }
              else {
                a.infoLink = null;
              }
              if (ListMes[i].listFile && ListMes[i].listFile.length && (ListMes[i].listFile.length > 0)) {
                let listFileFirst = [];
                for (let j = 0; j < ListMes[i].listFile.length; j++) {
                  listFileFirst.push(
                    fInfoFile(
                      ListMes[i].listFile[j].messageType || "",
                      ListMes[i].listFile[j].nameFile || "",
                      ListMes[i].listFile[j].sizeFile || 0,
                      ListMes[i].listFile[j].height || 0,
                      ListMes[i].listFile[j].width || 0
                    ));
                }
                a.listFile = listFileFirst;
              }
              else {
                a.listFile = [];
              }
              if (ListMes[i].localFile && ListMes[i].localFile.length && (ListMes[i].localFile.length > 0)) {
                let localFileFirst = [];
                for (let j = 0; j < ListMes[i].localFile.length; j++) {
                  localFileFirst.push(
                    localfile(
                      ListMes[i].localFile[j].IdDevice || "",
                      ListMes[i].localFile[j].pathFile || ""
                    )

                  );
                }
                a.localFile = localFileFirst;
              }
              else {
                a.localFile = [];
              }
              if (a.messageType == "sendCv") {
                for (let j = 0; j < a.listFile.length; j++) {
                  if (a.listFile[j].fullName.split(".")[a.listFile[j].fullName.split(".").length - 1] == "pdf") {
                    a.linkPdf = `https://ht.timviec365.vn:9002/uploads/${a.listFile[j].fullName}`;
                  }
                  else if (a.listFile[j].fullName.split(".")[a.listFile[j].fullName.split(".").length - 1] == "png") {
                    a.linkPng = `https://ht.timviec365.vn:9002/uploads/${a.listFile[j].fullName}`;
                  }
                }
              }
              a.emotionMessage = [];
              if (ListMes[i].emotion) {
                if (ListMes[i].emotion.Emotion1 && (String(ListMes[i].emotion.Emotion1).trim() != "")) {
                  a.emotionMessage.push(fEmotion(1, ListMes[i].emotion.Emotion1.split(","), `${urlImgHost()}Emotion/Emotion1.png`))
                }
                if (ListMes[i].emotion.Emotion2 && (String(ListMes[i].emotion.Emotion2).trim() != "")) {
                  a.emotionMessage.push(fEmotion(2, ListMes[i].emotion.Emotion2.split(","), `${urlImgHost()}Emotion/Emotion2.png`))
                }
                if (ListMes[i].emotion.Emotion3 && (String(ListMes[i].emotion.Emotion3).trim() != "")) {
                  a.emotionMessage.push(fEmotion(3, ListMes[i].emotion.Emotion3.split(","), `${urlImgHost()}Emotion/Emotion3.png`))
                }
                if (ListMes[i].emotion.Emotion4 && (String(ListMes[i].emotion.Emotion4).trim() != "")) {
                  a.emotionMessage.push(fEmotion(4, ListMes[i].emotion.Emotion4.split(","), `${urlImgHost()}Emotion/Emotion4.png`))
                }
                if (ListMes[i].emotion.Emotion5 && (String(ListMes[i].emotion.Emotion5).trim() != "")) {
                  a.emotionMessage.push(fEmotion(5, ListMes[i].emotion.Emotion5.split(","), `${urlImgHost()}Emotion/Emotion5.png`))
                }
                if (ListMes[i].emotion.Emotion6 && (String(ListMes[i].emotion.Emotion6).trim() != "")) {
                  a.emotionMessage.push(fEmotion(6, ListMes[i].emotion.Emotion6.split(","), `${urlImgHost()}Emotion/Emotion6.png`))
                }
                if (ListMes[i].emotion.Emotion7 && (String(ListMes[i].emotion.Emotion7).trim() != "")) {
                  a.emotionMessage.push(fEmotion(7, ListMes[i].emotion.Emotion7.split(","), `${urlImgHost()}Emotion/Emotion7.png`))
                }
                if (ListMes[i].emotion.Emotion8 && (String(ListMes[i].emotion.Emotion8).trim() != "")) {
                  a.emotionMessage.push(fEmotion(8, ListMes[i].emotion.Emotion8.split(","), `${urlImgHost()}Emotion/Emotion8.png`))
                }
              }
              else {
                a.emotion = ListMes[i].emotion || {};
                a.emotionMessage = [];
              }
              if (ListMes[i].messageType == "sendProfile") {
                if (!isNaN(ListMes[i].message)) {
                  let userData = await User.findOne({ _id: ListMes[i].message });
                  if (userData && userData.userName) {
                    let b = {};
                    b.iD365 = userData.id365;
                    b.idTimViec = userData.idTimViec;
                    b.type365 = userData.type365;
                    b.password = "";
                    b.phone = userData.phone;
                    // b.notificationPayoff = userData.notificationPayoff;
                    b.notificationPayoff = 1
                    // b.notificationCalendar = userData.notificationCalendar;
                    b.notificationCalendar = 1
                    // b.notificationReport = userData.notificationReport;
                    b.notificationReport = 1
                    // b.notificationOffer = userData.notificationOffer;
                    b.notificationOffer = 1
                    // b.notificationPersonnelChange = userData.notificationPersonnelChange;
                    b.notificationPersonnelChange = 1
                    // b.notificationRewardDiscipline = userData.notificationRewardDiscipline;
                    b.notificationRewardDiscipline = 1
                    // b.notificationNewPersonnel = userData.notificationNewPersonnel;
                    b.notificationNewPersonnel = 1
                    // b.notificationChangeProfile = userData.notificationChangeProfile;
                    b.notificationChangeProfile = 1
                    // b.notificationTransferAsset = userData.notificationTransferAsset;
                    b.notificationTransferAsset = 1
                    b.acceptMessStranger = userData.acceptMessStranger;
                    b.type_Pass = 0;
                    b.companyName = userData.companyName;
                    b.secretCode = "";
                    b.notificationMissMessage = 0;
                    b.notificationCommentFromTimViec = 0;
                    b.notificationCommentFromRaoNhanh = 0;
                    b.notificationTag = 0;
                    b.notificationSendCandidate = 0;
                    b.notificationChangeSalary = 0;
                    b.notificationAllocationRecall = 0;
                    b.notificationAcceptOffer = 0;
                    b.notificationDecilineOffer = 0;
                    b.notificationNTDPoint = 0;
                    b.notificationNTDExpiredPin = 0;
                    b.notificationNTDExpiredRecruit = 0;
                    b.fromWeb = userData.fromWeb;
                    b.notificationNTDApplying = 0;
                    b.userQr = null;
                    b.id = userData._id;
                    b.email = userData.email;
                    b.userName = userData.userName;
                    b.avatarUser = userData.avatarUser;
                    b.status = userData.status;
                    b.active = userData.active;
                    b.isOnline = userData.isOnline;
                    b.looker = userData.looker;
                    b.statusEmotion = userData.statusEmotion;
                    b.lastActive = userData.lastActive;

                    if (String(userData.avatarUser).trim != "") {
                      b.linkAvatar = `${urlImgHost()}avatarUser/${userData._id}/${userData.avatarUser}`;
                    }
                    else {
                      b.linkAvatar = `${urlImgHost()}avatar/${userData.userName[0]}_${getRandomInt(1, 4)}.png`
                    }
                    b.companyId = userData.companyId;

                    let status = await RequestContact.findOne({
                      $or: [
                        { userId: Number(req.body.UserId), contactId: userData._id },
                        { userId: userData._id, contactId: Number(req.body.UserId) }
                      ]
                    });
                    if (status) {
                      if (status.status == "accept") {
                        b.friendStatus = "friend";
                      }
                      else {
                        b.friendStatus = status.status;
                      }
                    }
                    else {
                      b.friendStatus = "none";
                    }
                    a.userProfile = b;
                  }
                  else {
                    a.userProfile = null;
                  }
                }

              }
              else {
                a.userProfile = null;
              }
              a.link = ListMes[i]?.infoLink?.linkHome;
              a.linkNotification = ListMes[i]?.infoLink?.linkHome
              a.listTag = null;
              a.file = a.listFile;
              a.quote = null;
              a.profile = a.userProfile;
              a.deleteTime = ListMes[i].deleteTime;
              a.deleteType = ListMes[i].deleteType;
              a.deleteDate = String('0001-01-01T00:00:00.000+00:00');
              a.infoSupport = ListMes[i].infoSupport;
              a.liveChat = ListMes[i].liveChat;
              a.isClicked = ListMes[i].isClicked || 0;
              if (ListMes[i] && ListMes[i].notiClicked) {
                if (ListMes[i].notiClicked.includes(Number(req.body.adminId))) {
                  a.isClicked = 1;
                }
              }
              if (ListMessFavour && ListMessFavour.includes(ListMes[i]._id)) {
                a.IsFavorite = 1;
              }
              else {
                a.IsFavorite = 0;
              }
              if (ListMes[i].infoSupport) {
                if (ListMes[i].infoSupport.status) {
                  if (ListMes[i].infoSupport.status == 1) {
                    let a = "k add"
                  }
                  else {
                    ListMessFinal.push(a)
                  }
                }
                else {
                  ListMessFinal.push(a)
                }
              }
              else {
                ListMessFinal.push(a)
              }
            }
          }
          result.push({
            conversationId: conversation._id,
            countMessage: conversation.countMess,
            message_info: null,
            listMessages: ListMessFinal,
            dataUserSend
          })
        })
      ).catch(function (err) {
        console.log(err)
      })
      res.json({
        data: {
          result: true,
          messsage: "Lấy danh sách tin nhắn thành công",
          data: result
        },
        error: null
      })
    }
    else {
      res.status(200).json(createError(200, "Thiếu thông tin truyền lên"))
    }
  } catch (err) {
    console.log(err)
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"))
  }
}

//xoa tin nha
export const RecallMessage = async (req, res) => {
  try {
    const messId = req.body.MessageID;
    const conversationId = Number(req.body.ConversationID);
    const userId = Number(messId.split("_")[1]);
    let prev = null, next = null
    let listFastmess = []
    let findFast = await FastMessage.find({ userId: userId }, { message: 1 }).lean()
    if (findFast) {
      for (let i = 0; i < findFast.length; i++) {
        listFastmess.push(findFast[i].message)
      }
    }
    const res1 = await Conversation.aggregate([
      {
        $match:
        {
          _id: conversationId,
        },
      },
      {
        $project:
        {
          memberList: 1,
          index: {
            $indexOfArray: [
              "$messageList._id",
              messId,
            ],
          },
          size: {
            $size: "$messageList",
          },
          message: {
            $filter: {
              input: "$messageList",
              as: "messagelist",
              cond: {
                $eq: [
                  "$$messagelist._id",
                  messId,
                ],
              },
            },
          },
        },
      },
    ])

    const time = new Date()
    time.setHours(time.getHours() - 24)
    let createAt = new Date();
    if (res1 && res1.length && res1[0].message && res1[0].message.length && res1[0].message[0].createAt) {
      createAt = res1[0].message[0].createAt
    }

    if (createAt < time) {
      return res.send(createError(400, 'Không thể xóa tin nhắn sau 24 giờ'))
    }
    if (res1[0].index === 0 && res1[0].size !== 1) {
      const data = await Conversation.aggregate([
        {
          $match: {
            _id: conversationId
          }
        },
        {
          $project: {
            next: { $arrayElemAt: ['$messageList', res1[0].index + 1] }
          }
        }
      ])
      next = data[0].next
    }
    else if (res1[0].index === res1[0].size - 1 && res1[0].size !== 1) {
      const data = await Conversation.aggregate([
        {
          $match: {
            _id: conversationId
          }
        },
        {
          $project: {
            prev: { $arrayElemAt: ['$messageList', res1[0].index - 1] }
          }
        }
      ])
      prev = data[0].prev
    }
    else if (res1[0].size !== 1) {
      const data = await Conversation.aggregate([
        {
          $match: {
            _id: conversationId
          }
        },
        {
          $project: {
            next: { $arrayElemAt: ['$messageList', res1[0].index + 1] }
          }
        }
      ])
      next = data[0].next
      prev = data[0].prev
    }
    const memberList = []
    for (let i = 0; i < res1[0].memberList.length; i++) {
      memberList.push(res1[0].memberList[i].memberId)
    }

    if (res1 && res1.length && res1[0].message && res1[0].message.length && res1[0].message[0] && res1[0].message[0].messageType === 'link'
      || (findFast && res1 && res1.length && res1[0].message && res1[0].message.length && res1[0].message[0] && res1[0].message[0].messageType === 'sendPhoto' && prev
        && listFastmess.includes(prev.message))) {
      //Xóa tin nhắn trước đó
      if (prev && prev._id) {
        Conversation.updateOne(
          { _id: conversationId, "messageList._id": prev._id },
          {
            $set: {
              "messageList.$.message": "Tin nhắn đã được thu hồi",
              "messageList.$.messageType": "text",
              "messageList.$.isEdited": 3,
              timeLastChange: Date.now()
            }
          }
        ).catch((e) => { console.log(e) })
      }
      Conversation.updateOne(
        { _id: conversationId, "messageList._id": messId },
        {
          $pull: { messageList: { _id: messId } }
        }
      ).catch((e) => { console.log(e) })
      const messageInfo = {
        ConversationID: Number(conversationId),
        MessageID: messId
      }
      socket.emit('DeleteMessage', messageInfo, memberList)
      const messageInfo1 = {
        ConversationID: Number(conversationId),
        MessageID: (prev && prev.id) ? prev._id : "",
        Message: 'Tin nhắn đã được thu hồi'
      }
      socket.emit('EditMessage', messageInfo1, memberList)
    }
    else if (res1 && res1.length && res1[0].message && res1[0].message.length && res1[0].message[0].messageType === 'text' && next
      && (next.messageType === 'link' || (findFast && next.messageType === 'sendPhoto' && listFastmess.includes(res1 && res1.length && res1[0].message && res1[0].message[0].message)))) {
      Conversation.updateOne(
        { _id: conversationId, "messageList._id": messId },
        {
          $set: {
            "messageList.$.message": "Tin nhắn đã được thu hồi",
            "messageList.$.messageType": "text",
            "messageList.$.isEdited": 3,
            "messageList.$.quoteMessage": "",
            "messageList.$.messageQuote": "",
            timeLastChange: Date.now()
          }
        }
      ).catch((e) => { console.log(e) })
      Conversation.updateOne(
        { _id: conversationId, "messageList._id": next._id },
        {
          $pull: { messageList: { _id: next._id } }
        }
      ).catch((e) => { console.log(e) })
      const messageInfo = {
        ConversationID: Number(conversationId),
        MessageID: next._id
      }
      socket.emit('DeleteMessage', messageInfo, memberList)
    }
    else {
      Conversation.updateOne(
        { _id: conversationId, "messageList._id": messId },
        {
          $set: {
            "messageList.$.message": "Tin nhắn đã được thu hồi",
            "messageList.$.messageType": "text",
            "messageList.$.isEdited": 3,
            "messageList.$.quoteMessage": "",
            "messageList.$.messageQuote": "",
            timeLastChange: Date.now()
          }
        }
      ).catch((e) => { console.log(e) })
    }
    const data = {
      result: true,
      message: "Xóa tin nhắn thành công",
    };
    return res.send({ data, error: null });
  } catch (err) {
    console.log(err)
    if (err) return res.send(createError(200, err.message));
  }
};


export const DeleteMessage = async (req, res) => {
  try {
    const conversationID = Number(req.body.ConversationID) || "";
    const messageId = req.body.MessageID || "";

    if (!(conversationID && messageId)) {
      return res.send(createError(200, "Thiếu thông tin truyền lên"));
    }
    const filter = {
      _id: conversationID,
      messageList: { $elemMatch: { _id: { $eq: messageId } } },
    };
    const update = {
      $pull: {
        messageList: { _id: messageId }
      },
    };
    const exCons = await Conversation.findOneAndUpdate(filter, update);
    if (!exCons) return res.send(createError(200, "Tin nhắn không tồn tại"));
    const existConversation = await Conversation.findById(conversationID)
    if (existConversation.messageList.length > 0) {
      existConversation.timeLastMessage =
        existConversation.messageList[
          existConversation.messageList.length - 1
        ].createAt;
    }
    await existConversation.save();
    const data = {
      result: true,
      message: "Xoá nhắn thành công",
    };
    return res.send({ data, error: null });
  } catch (err) {
    console.log(err);
    if (err) return res.send(createError(200, err.message));
  }
};
//Sua tin nhan
export const EditMessage = async (req, res) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.SenderID)) {
        console.log("Token hop le, EditMessage")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    const conversationID = Number(req.body.ConversationID) || "";
    const senderID = Number(req.body.SenderID) || "";
    const messageType = req.body.MessageType || "";
    const message = req.body.Message || "";
    const messageId = req.body.MessageID || "";
    const listTag = req.body.ListTag || "";
    const quote = req.body.Quote || "";
    const profile = req.body.Profile || "";
    const file = req.body.File || "";
    const listMember = req.body.ListMember || "";
    const isOnline = req.body.IsOnline || "";
    const conversationName = req.body.ConversationName || "";
    const isGroup = req.body.IsGroup || "";
    const deleteTime = req.body.DeleteTime || "";
    const deleteType = req.body.DeleteType || "";
    const liveChat = req.body.LiveChat || "";
    const infoSupport = req.body.InfoSupport || "";

    if (!(message && messageId)) {
      return res.send(createError(200, "Thiếu thông tin truyền lên"));
    }
    const filter = { _id: conversationID, messageList: { $elemMatch: { _id: { $eq: messageId } } } };
    const update = {
      $set: {
        "messageList.$.message": message,
        "messageList.$.isEdited": 1,
        timeLastChange: Date.now()
      },
    };
    const exCons = await Conversation.findOneAndUpdate(filter, update);

    if (!exCons) return res.send(createError(200, "Tin nhắn không tồn tại"));
    const data = {
      result: true,
      message: "Sửa nhắn thành công",
    };
    return res.send({ data, error: null });
  } catch (err) {
    console.log(err);
    if (err) return res.send(createError(200, err.message));
  }
};

//Lay tin nhan ver2
export const GetListMessage_v2 = async (req, res) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.userId)) {
        console.log("Token hop le, GetListMessage_v2")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    const userId = Number(req.body.userId);
    const conversationId = JSON.parse(req.body.conversationId);
    const displayMessage = JSON.parse(req.body.displayMessage);
    if (userId == null || conversationId == null || displayMessage == null) {
      return res.send(createError(200, "Thiêu thông tin truyền lên"));
    }
    const listCons = await Conversation.aggregate([
      {
        $match: {
          _id: {
            $in: conversationId,
          },
          "memberList.memberId": userId,
        },
      },
      {
        $project: {
          _id: 0,
          conversationID: "$_id",
          countMessage: {
            $size: "$messageList",
          },
          listMessages: {
            $slice: [
              {
                $filter: {
                  input: "$messageList",
                  as: "messagelist",
                  cond: {
                    $gte: ["$$messagelist.createAt", Date.now()]
                  },
                }
              },
              -20
            ]

          },
          sender: {
            $filter: {
              input: "$memberList",
              as: "mem",
              cond: {
                $eq: ["$$mem.memberId", userId],
              },
            },
          },
        },
      },
      {
        $unwind: {
          path: "$sender",
        },
      },
      {
        $project: {
          conversationID: 1,
          countMessage: 1,
          listMessages: 1,
          isFavorite: "$sender.isFavorite",
          profiles: {
            $filter: {
              input: "$listMessages",
              as: "mess",
              cond: {
                $eq: ["$$mess.messageType", "sendProfile"],
              },
            },
          },
        },
      },
      {
        $project: {
          conversationID: 1,
          countMessage: 1,
          listMessages: 1,
          isFavorite: 1,
          profiles: {
            message: 1,
          },
        },
      },
    ]);

    for (const [idx, con] of listCons.entries()) {
      con.listMessages = con.listMessages.filter(
        (e) => e.displayMessage > displayMessage[idx]
      );
      const profiles = await User.find({
        _id: con.profiles.map((e) => (e = Number(e.message))),
      }).lean();
      con.listMessages = con.listMessages.map((e) => {
        e["messageID"] = e._id;
        e["emotionMessage"] = e.emotion;
        e["conversationID"] = con.conversationID;
        e.createAt = date.format(e.createAt, "YYYY-MM-DDTHH:mm:ss.SSS+07:00");
        e["userProfile"] = null;
        e.deleteDate = date.format(
          e.deleteDate || new Date(),
          "YYYY-MM-DDTHH:mm:ss.SSS+07:00"
        );
        if (e.infoLink) {
          e.infoLink = fInfoLink(
            e._id,
            e.infoLink.title,
            e.infoLink.description,
            e.infoLink.linkHome,
            e.infoLink.image,
            e.infoLink.isNotification
          );
        }
        if (e.listFile && e.listFile.length) {
          e.listFile = e.listFile.map(
            (listF) =>
            (listF = fInfoFile(
              null,
              listF.nameFile,
              listF.sizeFile,
              listF.height,
              listF.width
            ))
          );
        }
        let tempEmote = [];
        for (const emote in e.emotionMessage) {
          if (e.emotionMessage[emote]) {
            const type = Number(emote.substring(emote.length - 1));
            const listUserId = e.emotionMessage[emote].split(",");
            const linkEmotion = `${urlImgHost}Emotion/${emote}.png`;
            tempEmote.push(fEmotion(type, listUserId, linkEmotion, null));
          }
        }
        if (e.messageType === "sendProfile") {
          const uid = Number(e.message)
          const contact = profiles.find((e) => e._id === uid);
          console.log(contact);
          e["userProfile"] = contact;
        }
        e.emotionMessage = tempEmote;
        e["isFavorite"] = con.isFavorite;
        e["infoSupport"] = null;
        e["liveChat"] = null;
        e["isClicked  "] = null;
        e["linkNotification  "] = null;
        delete e._id;
        delete e.emotion;
        return (e = { ...e });
      });
      delete con.profiles;
      listCons[idx] = con
    }
    const data = {
      result: true,
      message: "Lấy thông tin thành công",
      listConversation: listCons,
    };
    return res.send({ data, error: null });
  } catch (err) {
    if (err) {
      console.log(err);
      return res.send(createError(200, err.message));
    }
  }
};


//Danh dau tin nhan
export const SetFavoriteMessage = async (req, res, next) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.UserId)) {
        console.log("Token hop le, SetFavoriteMessage")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body && req.body.UserId && req.body.ConversationId && req.body.MessageId) {
      const userId = Number(req.body.UserId)
      const conversationId = Number(req.body.ConversationId)
      const messageId = req.body.MessageId

      // const conv = await Conversation.findOne({ _id: conversationId, "memberList.memberId": userId }, { "memberList.favoriteMessage": 1, "memberList.memberId": 1 })
      const conv = await Conversation.aggregate([
        {
          $match:
            { _id: conversationId, "memberList.memberId": userId },
        },
        {
          $project: {
            memberList: {
              $filter: {
                input: "$memberList",
                as: "memberList",
                cond: {
                  $eq: ["$$memberList.memberId", Number(userId)]
                },
              }
            }
          }
        }
      ]);
      if (conv.length > 0) {
        if (conv[0].memberList[0].favoriteMessage && conv[0].memberList[0].favoriteMessage.includes(messageId)) {
          res.status(200).json(createError(200, "Tin nhắn này đã được đánh dấu"));
        }
        else {
          const favoriteMessage = conv[0].memberList[0].favoriteMessage ? conv[0].memberList[0].favoriteMessage : []
          favoriteMessage.push(messageId)
          const result = await Conversation.findOneAndUpdate(
            { _id: conversationId, "memberList.memberId": userId },
            {
              $set: {
                "memberList.$.favoriteMessage": favoriteMessage
              }
              // $push: { "memberList.$.favoriteMessage": messageId },
            },
            { projection: { _id: 1 } })
          if (result) {
            res.status(200).json({
              data: {
                result: true,
                message: "Tin nhắn đã được đánh dấu",
              },
              error: null
            });
          }
          else {
            res.status(200).json(createError(200, "Đánh đấu tin nhắn thất bại"));
          }
        }

      }
      else {
        res.status(200).json(createError(200, "Thông tin truyền lên không chính xác"));
      }
    }
    else {
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  } catch (err) {
    console.log(err);
    res.status(200).json(createError(200, err.message));
  }

}


//Bo danh dau tin nhan
export const RemoveFavoriteMessage = async (req, res, next) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.UserId)) {
        console.log("Token hop le, RemoveFavoriteMessage")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body && req.body.UserId && req.body.ConversationId && req.body.MessageId) {
      const userId = Number(req.body.UserId)
      const conversationId = Number(req.body.ConversationId)
      const messageId = req.body.MessageId

      const conv = await Conversation.findOne({ _id: conversationId, "memberList.memberId": userId }, { "memberList.favoriteMessage": 1, "memberList.memberId": 1 }).lean()
      if (conv) {
        let index
        for (let i = 0; i < conv.memberList.length; i++) {
          if (conv.memberList[i].memberId === userId) {
            index = i
            break
          }
        }
        if (!conv.memberList[index].favoriteMessage || !conv.memberList[index].favoriteMessage.includes(messageId)) {
          res.status(200).json(createError(200, "Tin nhắn này không tồn tại"));
        }
        else {
          let favoriteMessage = conv.memberList[index].favoriteMessage
          favoriteMessage.splice(favoriteMessage.indexOf(messageId), 1)
          const result = await Conversation.findOneAndUpdate(
            { _id: conversationId, "memberList.memberId": userId },
            {
              $set: {
                "memberList.$.favoriteMessage": favoriteMessage
                // $push: { "memberList.$.favoriteMessage": messageId },
              }
            },
            { projection: { _id: 1 } })
          if (result) {
            res.status(200).json({
              data: {
                message: "Bỏ đánh đấu tin nhắn thành công",
              },
              error: null
            });
          }
          else {
            res.status(200).json(createError(200, "Bỏ đánh đấu tin nhắn thất bại"));
          }
        }

      }
      else {
        res.status(200).json(createError(200, "Thông tin truyền lên không chính xác"));
      }
    }
    else {
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  } catch (err) {
    console.log(err);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }

}

//Tha cam xuc
export const SetEmotionMessage = async (req, res, next) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status) {
        console.log("Token hop le, SetEmotionMessage")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body.MessageID && req.body.Type) {
      const messageId = req.body.MessageID

      const type = Number(req.body.Type)
      const listUserId = req.body.ListUserId ? req.body.ListUserId : ''
      let update

      switch (type) {
        case 1: {
          update = { $set: { "messageList.$.emotion.Emotion1": listUserId, timeLastChange: Date.now() } }
          break
        }
        case 2: {
          update = { $set: { "messageList.$.emotion.Emotion2": listUserId, timeLastChange: Date.now() } }
          break
        }
        case 3: {
          update = { $set: { "messageList.$.emotion.Emotion3": listUserId, timeLastChange: Date.now() } }
          break
        }
        case 4: {
          update = { $set: { "messageList.$.emotion.Emotion4": listUserId, timeLastChange: Date.now() } }
          break
        }
        case 5: {
          update = { $set: { "messageList.$.emotion.Emotion5": listUserId, timeLastChange: Date.now() } }
          break
        }
        case 6: {
          update = { $set: { "messageList.$.emotion.Emotion6": listUserId, timeLastChange: Date.now() } }
          break
        }
        case 7: {
          update = { $set: { "messageList.$.emotion.Emotion7": listUserId, timeLastChange: Date.now() } }
          break
        }
        case 8: {
          update = { $set: { "messageList.$.emotion.Emotion8": listUserId, timeLastChange: Date.now() } }
          break
        }
      }
      let result = await Conversation.updateMany(
        {
          "messageList._id": String(messageId)
        },
        update,
        // { projection: { _id: 1 } }
      )
      if (result) {
        res.status(200).json({
          data: {
            result: true,
            message: "Thả cảm xúc thành công",
          },
          error: null
        });
      }
    }
    else {
      res.status(200).json(createError(200, "Thiếu thông tin truyền lên"))
    }
  } catch (err) {
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}



//Lay danh sach tin nhan danh dau
export const GetListFavoriteMessage = async (req, res, next) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.userId)) {
        console.log("Token hop le, RemoveFavoriteMessage")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body.userId && req.body.listMess && req.body.countMessage) {
      const listMessages = []
      const userId = Number(req.body.userId);
      const countMessage = Number(req.body.countMessage);
      const listMess = Number(req.body.listMess)

      const messages = await Conversation.aggregate([
        {
          '$match': {
            'memberList.memberId': userId,
            'memberList.favoriteMessage.0': {
              '$exists': true
            }
          }
        }, {
          '$project': {
            'messageList': 1,
            'member': {
              '$filter': {
                'input': '$memberList',
                'as': 'mem',
                'cond': {
                  '$eq': [
                    '$$mem.memberId', userId
                  ]
                }
              }
            }
          }
        }, {
          '$unwind': {
            'path': '$member'
          }
        }, {
          '$project': {
            'messageList': 1,
            'favo': {
              '$filter': {
                'input': '$member.favoriteMessage',
                'as': 'fav',
                'cond': {
                  '$ne': [
                    '$$fav', ''
                  ]
                }
              }
            }
          }
        }, {
          '$match': {
            'favo.0': {
              '$exists': true
            }
          }
        }, {
          '$unwind': {
            'path': '$favo'
          }
        }, {
          '$project': {
            'message': {
              '$filter': {
                'input': '$messageList',
                'as': 'mess',
                'cond': {
                  '$and': [
                    {
                      '$eq': [
                        '$$mess._id', '$favo'
                      ]
                    },
                    {
                      '$ne': [
                        '$$mess.isEdited', 2
                      ]
                    },
                    {
                      '$ne': [
                        '$$mess.isEdited', 3
                      ]
                    }
                  ]
                }
              }
            }
          }
        }, {
          '$unwind': {
            'path': '$message'
          }
        }, {
          '$lookup': {
            'from': 'Users',
            'localField': 'message.senderId',
            'foreignField': '_id',
            'as': 'user'
          }
        }, {
          '$unwind': {
            'path': '$user'
          }
        }, {
          '$project': {
            'messageID': '$message._id',
            'emotionMessage': '$message.emotion',
            'conversationID': '$_id',
            'senderID': '$message.senderId',
            'senderName': '$user.userName',
            'senderAvatar': '$user.avatarUser',
            'messageType': '$message.messageType',
            'message': '$message.message',
            'isEdited': '$message.isEdited',
            'quoteMessage': '$message.quoteMessage',
            'infoLink': '$message.infoLink',
            'createAt': {
              '$dateToString': {
                'date': '$message.createAt',
                'timezone': '+07:00',
                'format': '%G-%m-%dT%H:%M:%S.%L+07:00'
              }
            },
            'listFile': '$message.listFile',
            'deleTime': '$message.deleTime',
            'deleType': '$message.deleteType',
            'deleteDate': {
              '$dateToString': {
                'date': '$message.deleteDate',
                'timezone': '+07:00',
                'format': '%G-%m-%dT%H:%M:%S.%L+07:00'
              }
            },
            'infoSupport': '$message.infoSupport',
            'liveChat': '$message.liveChat',
            'notiClicked': '$message.notiClicked',
          }
        }, {
          '$sort': {
            'createAt': -1
          }
        }, {
          '$skip': listMess
        }, {
          '$limit': countMessage
        }
      ])
      if (messages.length > 0) {
        for (let i = 0; i < messages.length; i++) {
          if (messages[i].senderAvatar !== '') {
            messages[i].senderAvatar = `${urlImgHost()}avatarUser/${messages[i].senderID}/${messages[i].senderAvatar}`
          }
          else {
            messages[i].senderAvatar = `${urlImgHost()}avatar/${messages[i].senderName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
          }
          const a = {
            messageID: messages[i].messageID,
            conversationID: messages[i].conversationID,
            senderID: messages[i].senderID,
            senderName: messages[i].senderName,
            senderAvatar: messages[i].senderAvatar,
            messageType: messages[i].messageType,
            message: messages[i].message,
            isEdited: messages[i].isEdited,
            createAt: messages[i].createAt,
            deleTime: messages[i].deleTime,
            deleteType: messages[i].deleteType,
            deleteDate: messages[i].deleteDate,
            link: null,
            file: null,
            quote: null,
            listTag: null,
            infoSupport: messages[i].infoSupport,
            liveChat: messages[i].liveChat,
            linkNotification: null,
            isClicked: messages[i].notiClicked ? (messages[i].notiClicked.includes(Number(userId)) ? 1 : 0) : 0,
          }
          if (messages[i].infoLink) {
            if (messages[i].infoLink.title) {
              a.infoLink = {
                messageID: messages[i].messageID,
                typeLink: messages[i].messageType,
                description: messages[i].infoLink.description,
                title: messages[i].infoLink.title,
                linkHome: messages[i].infoLink.linkHome,
                image: messages[i].infoLink.image,
                haveImage: messages[i].infoLink.image == null ? 'False' : 'True',
                IsNotification: messages[i].infoLink.isNotification
              }
              if (!(messages[i].infoLink.image == null || messages[i].infoLink.image.trim() == null)) {
                a.infoLink.mage = a.infoLink.image.replace('amp;', '')
              }
            }
          }
          else {
            a.infoLink = messages[i].infoLink
          }
          if (messages[i].listFile && messages[i].listFile.length && (messages[i].listFile.length > 0)) {
            let listFileFirst = [];
            for (let j = 0; j < messages[i].listFile.length; j++) {
              listFileFirst.push(
                fInfoFile(
                  messages[i].listFile[j].messageType,
                  messages[i].listFile[j].nameFile,
                  messages[i].listFile[j].sizeFile,
                  messages[i].listFile[j].height,
                  messages[i].listFile[j].width
                ));
            }
            a.listFile = listFileFirst;
          }
          else {
            a.listFile = [];
          }
          if (messages[i].emotionMessage !== null) {
            a.emotionMessage = []
            if (messages[i].emotionMessage.Emotion1 !== '') {
              a.emotionMessage.push({
                type: 1,
                listUserId: messages[i].emotionMessage.Emotion1.split(','),
                linkEmotion: `${urlImgHost()}Emotion/Emotion1.png`,
                isChecked: false
              })
            }
            if (messages[i].emotionMessage.Emotion2 !== '') {
              a.emotionMessage.push({
                type: 2,
                listUserId: messages[i].emotionMessage.Emotion2.split(','),
                linkEmotion: `${urlImgHost()}Emotion/Emotion2.png`,
                isChecked: false
              })
            }
            if (messages[i].emotionMessage.Emotion3 !== '') {
              a.emotionMessage.push({
                type: 3,
                listUserId: messages[i].emotionMessage.Emotion3.split(','),
                linkEmotion: `${urlImgHost()}Emotion/Emotion3.png`,
                isChecked: false
              })
            }
            if (messages[i].emotionMessage.Emotion4 !== '') {
              a.emotionMessage.push({
                type: 4,
                listUserId: messages[i].emotionMessage.Emotion4.split(','),
                linkEmotion: `${urlImgHost()}Emotion/Emotion4.png`,
                isChecked: false
              })
            }
            if (messages[i].emotionMessage.Emotion5 !== '') {
              a.emotionMessage.push({
                type: 5,
                listUserId: messages[i].emotionMessage.Emotion5.split(','),
                linkEmotion: `${urlImgHost()}Emotion/Emotion5.png`,
                isChecked: false
              })
            }
            if (messages[i].emotionMessage.Emotion6 !== '') {
              a.emotionMessage.push({
                type: 6,
                listUserId: messages[i].emotionMessage.Emotion6.split(','),
                linkEmotion: `${urlImgHost()}Emotion/Emotion6.png`,
                isChecked: false
              })
            }
            if (messages[i].emotionMessage.Emotion7 !== '') {
              a.emotionMessage.push({
                type: 7,
                listUserId: messages[i].emotionMessage.Emotion7.split(','),
                linkEmotion: `${urlImgHost()}Emotion/Emotion7.png`,
                isChecked: false
              })
            }
            if (messages[i].emotionMessage.Emotion8 !== '') {
              a.emotionMessage.push({
                type: 8,
                listUserId: messages[i].emotionMessage.Emotion8.split(','),
                linkEmotion: `${urlImgHost()}Emotion/Emotion8.png`,
                isChecked: false
              })
            }
          }
          else {
            a.emotionMessage = message[i].emotionMessage
          }
          if (messages[i].quoteMessage && (messages[i].quoteMessage.trim() != "")) {
            let conversationTakeMessage = await Conversation.aggregate([
              {
                $match:
                {
                  _id: Number(messages[i].conversationID)
                }
              },
              {
                $project: {
                  messageList: {
                    $slice: [
                      {
                        $filter: {
                          input: "$messageList",
                          as: "messagelist",
                          cond: {
                            $eq: ["$$messagelist._id", messages[i].quoteMessage]
                          },
                        }
                      },
                      -1
                    ]
                  }
                }
              }
            ])
            if (conversationTakeMessage && conversationTakeMessage.length > 0 && conversationTakeMessage[0].messageList && conversationTakeMessage[0].messageList.length && (conversationTakeMessage[0].messageList.length > 0)) {
              let message = conversationTakeMessage[0].messageList[0];
              let senderData = await User.findOne({ _id: message.senderId }, { userName: 1 }).lean()
              if (senderData && senderData.userName) {
                a.quoteMessage = fMessageQuote(message._id, senderData.userName, message.senderId, message.messageType, message.message, message.createAt)
              }
            }
          }
          else {
            a.quoteMessage = messages[i].quoteMessage;
          }
          if (messages[i].messageType == "sendProfile") {
            let userData = await User.findOne({ _id: messages[i].message }).lean();
            if (userData && userData.userName) {
              let b = {};
              b.iD365 = userData.id365;
              b.idTimViec = userData.idTimViec;
              b.type365 = userData.type365;
              b.password = "";
              b.phone = userData.phone;
              // b.notificationPayoff = userData.notificationPayoff;
              b.notificationPayoff = 1
              // b.notificationCalendar = userData.notificationCalendar;
              b.notificationCalendar = 1
              // b.notificationReport = userData.notificationReport;
              b.notificationReport = 1
              // b.notificationOffer = userData.notificationOffer;
              b.notificationOffer = 1
              // b.notificationPersonnelChange = userData.notificationPersonnelChange;
              b.notificationPersonnelChange = 1
              // b.notificationRewardDiscipline = userData.notificationRewardDiscipline;
              b.notificationRewardDiscipline = 1
              // b.notificationNewPersonnel = userData.notificationNewPersonnel;
              b.notificationNewPersonnel = 1
              // b.notificationChangeProfile = userData.notificationChangeProfile;
              b.notificationChangeProfile = 1
              // b.notificationTransferAsset = userData.notificationTransferAsset;
              b.notificationTransferAsset = 1
              b.acceptMessStranger = userData.acceptMessStranger;
              b.type_Pass = 0;
              b.companyName = userData.companyName;
              b.secretCode = "";
              b.notificationMissMessage = 0;
              b.notificationCommentFromTimViec = 0;
              b.notificationCommentFromRaoNhanh = 0;
              b.notificationTag = 0;
              b.notificationSendCandidate = 0;
              b.notificationChangeSalary = 0;
              b.notificationAllocationRecall = 0;
              b.notificationAcceptOffer = 0;
              b.notificationDecilineOffer = 0;
              b.notificationNTDPoint = 0;
              b.notificationNTDExpiredPin = 0;
              b.notificationNTDExpiredRecruit = 0;
              b.fromWeb = userData.fromWeb;
              b.notificationNTDApplying = 0;
              b.userQr = null;
              b.id = userData._id;
              b.email = userData.email;
              b.userName = userData.userName;
              b.avatarUser = userData.avatarUser;
              b.status = userData.status;
              b.active = userData.active;
              b.isOnline = userData.isOnline;
              b.looker = userData.looker;
              b.statusEmotion = userData.statusEmotion;
              b.lastActive = userData.lastActive;

              if (String(userData.avatarUser).trim != "") {

                b.linkAvatar = `${urlImgHost}avatarUser/${userData._id}/${userData.avatarUser}`;
              }
              else {
                b.linkAvatar = `${urlImgHost}avatar/${userData.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
              }
              b.companyId = userData.companyId;

              // let status = await RequestContact.findOne({
              //   $or: [
              //     { userId: Number(req.body.adminId), contactId: userData._id },
              //     { userId: userData._id, contactId: Number(req.body.adminId) }
              //   ]
              // });
              // if (status) {
              //   if (status.status == "accept") {
              //     b.friendStatus = "friend";
              //   }
              //   else {
              //     b.friendStatus = status.status;
              //   }
              // }
              // else {
              //   b.friendStatus = "none";
              // }
              a.userProfile = b;
            }
            else {
              a.userProfile = null;
            }
          }
          else {
            a.userProfile = null;
          }
          listMessages.push(a)
        }
        res.json({
          data: {
            result: true,
            messageId: null,
            senderName: null,
            messsage: "Lấy danh sách tin nhắn thành công",
            countMessage: listMessages.length,
            message_info: null,
            listMessages: listMessages
          },
          error: null
        })
      }
      else {
        res.status(200).json(createError(200, "Cuộc trò chuyện không có tin nhắn nào"));
      }
    }
    else {
      res.status(200).json(createError(200, "Thiếu thông tin truyền lên"));
    }
  } catch (err) {
    console.log(err);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

//Lay thong tin tin nhan
export const GetMessage = async (req, res, next) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.userId)) {
        console.log("Token hop le, GetMessage")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    const messageId = req.body.MessageID
    const userId = Number(messageId.slice(messageId.indexOf('_') + 1))

    const messages = await Conversation.aggregate([
      {
        '$match': {
          // 'messageList.0': {
          //   '$exists': true
          // },
          'memberList.memberId': userId,
          'messageList._id': messageId,
        }
      },
      { $limit: 1 },
      {
        '$project': {
          'message': {
            '$filter': {
              'input': '$messageList',
              'as': 'mess',
              'cond': {
                '$eq': [
                  '$$mess._id', messageId
                ]
              }
            }
          },
          'liveChat': 1
        }
      }, {
        '$unwind': {
          'path': '$message'
        }
      }, {
        '$project': {
          '_id': 0,
          'messageID': '$message._id',
          'emotion': '$message.emotion',
          'conversationID': '$_id',
          'senderID': '$message.senderId',
          'senderName': null,
          'senderAvatar': null,
          'messageType': '$message.messageType',
          'message': '$message.message',
          'isEdited': '$message.isEdited',
          'quoteMessage': '$message.quoteMessage',
          'infoLink': '$message.infoLink',
          'createAt': {
            '$dateToString': {
              'date': '$message.createAt',
              'timezone': '+07:00',
              'format': '%G-%m-%dT%H:%M:%S.%L+07:00'
            }
          },
          'listFile': '$message.listFile',
          'deteleTime': '$message.deleteTime',
          'deleteDate': {
            '$dateToString': {
              'date': '$message.deleteDate',
              'timezone': '+07:00',
              'format': '%G-%m-%dT%H:%M:%S.%L+07:00'
            }
          },
          'notiClicked': '$message.notiClicked',
          'infoSupport': '$message.infoSupport'
        }
      }
    ])
    if (messages.length > 0) {
      if (messages[0].quoteMessage && (messages[0].quoteMessage.trim() != "")) {
        let conversationTakeMessage = await Conversation.aggregate([
          {
            $match:
            {
              _id: messages[0].conversationID
            }
          },
          { $limit: 1 },
          {
            $project: {
              messageList: {
                $slice: [
                  {
                    $filter: {
                      input: "$messageList",
                      as: "messagelist",
                      cond: {
                        $eq: ["$$messagelist._id", messages[0].quoteMessage]
                      },
                    }
                  },
                  -1
                ]
              }
            }
          }
        ])
        if (conversationTakeMessage && conversationTakeMessage.length > 0 && conversationTakeMessage[0].messageList && conversationTakeMessage[0].messageList.length && (conversationTakeMessage[0].messageList.length > 0)) {
          let message = conversationTakeMessage[0].messageList[0];
          let senderData = await User.findOne({ _id: message.senderId }, { userName: 1 }).lean()
          if (senderData && senderData.userName) {
            messages[0].quoteMessage = fMessageQuote(message._id, senderData.userName, message.senderId, message.messageType, message.message, message.createAt)
          }
        }
      }
      else {
        messages[0].quoteMessage = null
      }
      if (messages[0].infoLink && messages[0].infoLink.title) {
        messages[0].infoLink = fInfoLink(messages[0].messageID, messages[0].infoLink.title, messages[0].infoLink.description, messages[0].infoLink.linkHome, messages[0].infoLink.image, messages[0].infoLink.isNotification);
      }
      else {
        messages[0].infoLink = null
      }
      if (messages[0].listFile && messages[0].listFile.length && (messages[0].listFile.length > 0)) {
        let listFileFirst = [];
        for (let i = 0; i < messages[0].listFile.length; i++) {
          listFileFirst.push(
            fInfoFile(
              messages[0].listFile[i].messageType,
              messages[0].listFile[i].nameFile,
              messages[0].listFile[i].sizeFile,
              messages[0].listFile[i].height,
              messages[0].listFile[i].width
            ));
        }
        messages[0].listFile = listFileFirst;
      }
      messages[0].emotionMessage = [];
      if (messages[0].emotion) {
        if (String(messages[0].emotion.Emotion1).trim() != "") {
          messages[0].emotionMessage.push(fEmotion(1, messages[0].emotion.Emotion1.split(","), `${urlImgHost()}Emotion/Emotion1.png`))
        }
        if (String(messages[0].emotion.Emotion2).trim() != "") {
          messages[0].emotionMessage.push(fEmotion(2, messages[0].emotion.Emotion2.split(","), `${urlImgHost()}Emotion/Emotion2.png`))
        }
        if (String(messages[0].emotion.Emotion3).trim() != "") {
          messages[0].emotionMessage.push(fEmotion(3, messages[0].emotion.Emotion3.split(","), `${urlImgHost()}Emotion/Emotion3.png`))
        }
        if (String(messages[0].emotion.Emotion4).trim() != "") {
          messages[0].emotionMessage.push(fEmotion(4, messages[0].emotion.Emotion4.split(","), `${urlImgHost()}Emotion/Emotion4.png`))
        }
        if (String(messages[0].emotion.Emotion5).trim() != "") {
          messages[0].emotionMessage.push(fEmotion(5, messages[0].emotion.Emotion5.split(","), `${urlImgHost()}Emotion/Emotion5.png`))
        }
        if (String(messages[0].emotion.Emotion6).trim() != "") {
          messages[0].emotionMessage.push(fEmotion(6, messages[0].emotion.Emotion6.split(","), `${urlImgHost()}Emotion/Emotion6.png`))
        }
        if (String(messages[0].emotion.Emotion7).trim() != "") {
          messages[0].emotionMessage.push(fEmotion(7, messages[0].emotion.Emotion7.split(","), `${urlImgHost()}/Emotion/Emotion7.png`))
        }
        if (String(messages[0].emotion.Emotion8).trim() != "") {
          messages[0].emotionMessage.push(fEmotion(8, messages[0].emotion.Emotion8.split(","), `${urlImgHost()}Emotion/Emotion8.png`))
        }
      }
      delete messages[0].emotion
      if (messages[0].messageType == "sendProfile") {
        let userData = await User.findOne({ _id: messages[0].message }).lean();
        if (userData && userData.userName) {
          let b = {};
          b.iD365 = userData.id365;
          b.idTimViec = userData.idTimViec;
          b.type365 = userData.type365;
          b.password = "";
          b.phone = userData.phone;
          b.notificationPayoff = userData.notificationPayoff;
          b.notificationCalendar = userData.notificationCalendar;
          b.notificationReport = userData.notificationReport;
          b.notificationOffer = userData.notificationOffer;
          b.notificationPersonnelChange = userData.notificationPersonnelChange;
          b.notificationRewardDiscipline = userData.notificationRewardDiscipline;
          b.notificationNewPersonnel = userData.notificationNewPersonnel;
          b.notificationChangeProfile = userData.notificationChangeProfile;
          b.notificationTransferAsset = userData.notificationTransferAsset;
          b.acceptMessStranger = userData.acceptMessStranger;
          b.type_Pass = 0;
          b.companyName = userData.companyName;
          b.secretCode = "";
          b.notificationMissMessage = 0;
          b.notificationCommentFromTimViec = 0;
          b.notificationCommentFromRaoNhanh = 0;
          b.notificationTag = 0;
          b.notificationSendCandidate = 0;
          b.notificationChangeSalary = 0;
          b.notificationAllocationRecall = 0;
          b.notificationAcceptOffer = 0;
          b.notificationDecilineOffer = 0;
          b.notificationNTDPoint = 0;
          b.notificationNTDExpiredPin = 0;
          b.notificationNTDExpiredRecruit = 0;
          b.fromWeb = userData.fromWeb;
          b.notificationNTDApplying = 0;
          b.userQr = null;
          b.id = userData._id;
          b.email = userData.email;
          b.userName = userData.userName;
          b.avatarUser = userData.avatarUser;
          b.status = userData.status;
          b.active = userData.active;
          b.isOnline = userData.isOnline;
          b.looker = userData.looker;
          b.statusEmotion = userData.statusEmotion;
          b.lastActive = userData.lastActive;

          if (String(userData.avatarUser).trim != "") {
            b.linkAvatar = `${urlImgHost}avatarUser/${userData._id}/${userData.avatarUser}`;
          }
          else {
            b.linkAvatar = `${urlImgHost}avatar/${userData.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
          }
          b.companyId = userData.companyId;

          messages[0].userProfile = b;
        }
        else {
          messages[0].userProfile = null;
        }
      }
      else {
        messages[0].userProfile = null;
      }
      return res.json({
        data: {
          result: true,
          messageId: null,
          senderName: null,
          message: "Lấy thông tin tin nhắn thành công",
          countMessage: 0,
          message_info: messages[0],
          listMessages: null
        },
        error: null
      })
    }
    else {
      return res.status(200).json(createError(200, "Tin nhắn không tồn tại"));
    }
  } catch (err) {
    console.log(err)
    console.log(req.body)
    return res.status(200).json(createError(200, err.message));
  }
}

//Lay danh sach thu vien
export const GetListLibra = async (req, res, next) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status) {
        console.log("Token hop le, GetListLibra")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body.conversationId && req.body.countMessage) {
      const conversationId = Number(req.body.conversationId)
      const listMess = req.body.listMess ? Number(req.body.listMess) : 0
      const countMessage = Number(req.body.countMessage)
      const messageDisplay = req.body.messageDisplay ? Number(req.body.messageDisplay) : 0
      const type = Number(req.body.TYPE)

      //const messageType = type === 1 ? ['sendPhoto'] : (type === 2 ? ['sendFile'] : (type === 3) ? ['link'] : ['sendPhoto', 'sendFile', 'link'])
      const messageType = type === 1 ? ['sendPhoto'] : (type === 2 ? ['sendFile'] : (type === 3 ? ['link'] : (type === 4) ? ['text'] : ['sendPhoto', 'sendFile', 'link']))

      const messages = await Conversation.aggregate([
        {
          '$match': {
            '_id': conversationId
          }
        }, {
          '$project': {
            'messages': {
              '$filter': {
                'input': '$messageList',
                'as': 'mess',
                'cond': {
                  '$and': [
                    {
                      '$gt': [
                        '$$mess.displayMessage', messageDisplay
                      ]
                    }, {
                      '$in': [
                        '$$mess.messageType', messageType
                      ]
                    }
                  ]
                }
              }
            },
            'liveChat': 1
          }
        }, {
          '$unwind': {
            'path': '$messages'
          }
        }, {
          '$lookup': {
            'from': 'Users',
            'localField': 'messages.senderId',
            'foreignField': '_id',
            'as': 'user'
          }
        }, {
          '$unwind': {
            'path': '$user'
          }
        }, {
          '$project': {
            '_id': 0,
            'messageID': '$messages._id',
            'emotionMessage': '$messages.emotion',
            'conversationId': '$_id',
            'senderID': '$messages.senderId',
            'senderName': '$user.userName',
            'senderAvatar': '$user.avatarUser',
            'senderCompany': '$user.companyId',
            'messageType': '$messages.messageType',
            'message': '$messages.message',
            'isEdited': '$messages.isEdited',
            'quoteMessage': '$messages.quoteMessage',
            'infoLink': '$messages.infoLink',
            'createAt': {
              '$dateToString': {
                'date': '$messages.createAt',
                'timezone': '+07:00',
                'format': '%G-%m-%dT%H:%M:%S.%L+07:00'
              }
            },
            'listFile': '$messages.listFile',
            'deleteTime': '$messages.deleteTime',
            'deleteType': '$messages.deleteType',
            'deleteDate': {
              '$dateToString': {
                'date': '$messages.deleteDate',
                'timezone': '+07:00',
                'format': '%G-%m-%dT%H:%M:%S.%L+07:00'
              }
            }
          }
        }, {
          '$sort': {
            'createAt': -1
          }
        }, {
          '$skip': listMess
        }, {
          '$limit': countMessage
        }
      ])
      if (messages.length > 0) {
        for (let i = 0; i < messages.length; i++) {
          if (messages[i].senderAvatar !== '') {
            messages[i].senderAvatar = `${urlImgHost()}avatarUser/${messages[i].senderID}/${messages[i].senderAvatar}`
          }
          else {
            messages[i].senderAvatar = `${urlImgHost()}avatar/${messages[i].senderName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
          }
          if (messages[i].infoLink) {
            messages.infoLink = fInfoLink(messages[i].conversationId, messages[i].infoLink.title, messages[i].infoLink.description, messages[i].infoLink.linkHome, messages[i].infoLink.image, messages[i].infoLink.isNotification);
          }
          if (messages[i].listFile && messages[i].listFile.length && (messages[i].listFile.length > 0)) {
            let listFileFirst = [];
            for (let j = 0; j < messages[i].listFile.length; j++) {
              listFileFirst.push(
                fInfoFile(
                  messages[i].listFile[j].messageType,
                  messages[i].listFile[j].nameFile,
                  messages[i].listFile[j].sizeFile,
                  messages[i].listFile[j].height,
                  messages[i].listFile[j].width
                ));
            }
            messages[i].listFile = listFileFirst;
          }
        }
        res.json({
          data: {
            result: true,
            messageId: null,
            senderName: null,
            messsage: "Lấy danh sách thư viện thành công",
            countMessage: messages.length,
            message_info: null,
            listMessages: messages
          },
          error: null
        })
      }
      else {
        res.status(200).json(createError(200, "Cuộc trò chuyện không có ảnh, file, link nào"));
      }
    }
    else {
      res.status(200).json(createError(200, "Thiếu thông tin truyền lên"));
    }
  } catch (err) {
    console.error(err)
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

// gui tin nhan 
let flagsendMail = 0;
let transporter_zoho = nodemailer.createTransport({
  host: "smtp.zoho.com",
  secure: true,
  port: 465,
  auth: {
    user: 'admin@doithe247.com',
    pass: 'RKJm4VbkvEnP'
  }
});
// let smtpurl = 'https://api.smtp2go.com/v3/email/send'
// let smtpob = (content, receiver) => {
//   return {
//     'api_key': 'api-BE58282ED38E11EDAE63F23C91C88F4E',
//     'to': [`<${receiver}>`],
//     'sender': 'Công ty cổ phần thanh toán Hưng Hà <admin@doithe247.com>',
//     'subject': `Thông báo tin nhắn`,
//     'html_body': `${content}`
//   }
// }

async function sendMail(senderName, message, receiver, conversationId) {
  try {
    let conversationLink = `https://chat365.timviec365.vn/notification-${btoa(conversationId)}`
    let content = `
    <html>
    <body style="width: 100%;background-color: #dad7d7; text-align: justify;padding: 0;margin: 0;font-family: unset;padding-top: 20px;padding-bottom: 20px;">
        <table style="width: 600px;background:#fff; margin:0 auto;border-collapse: collapse;color: #000">
            <tr style="height: 11px;background-image: url(https://ht.timviec365.vn:9002/anh_mail/bg8.png);background-size:100% 100%;background-repeat: no-repeat;float: left;width: 100%;padding: 0px 30px;box-sizing: border-box;">
                <td> </td>
            </tr>
            <tr style="float: left;padding: 0px 10px; width: 100%; margin-bottom: 30px; ">
                <td style="width: 100%; float: left; text-align: center; border-bottom: 1px solid #D9D9D9; padding:20px 0px;">
                    <img src="https://ht.timviec365.vn:9002/anh_mail/bg9.png" style="height: 28px; width: 129px">
                </td>
            </tr>
            <tr style="float: left;padding:0px 25px 20px 25px;">
                <td>
                    <p style="font-size:18px;line-height:25px; margin-bottom:20px">Xin chào bạn</p>
                    <p style="font-size:18px;line-height:25px; margin-bottom:5px"><span style="font-weight: 500; color: #4C5BD4;">${senderName}</span> đã nhắn tin cho bạn qua <span style="font-weight: 500; color: #3F55C5;">chat365</span><span style="font-weight: 500; color: #3F55C5;">.vn</span> với nội dung:</p>
                </td>
            </tr>
            <tr style="float: left; padding:0px 25px 30px 25px;">
                <td style="padding: 40px;min-width:550px;background-image: url(https://ht.timviec365.vn:9002/anh_mail/bg6.png);background-size:100% 100%;background-repeat: no-repeat;float: left;box-sizing: border-box;">
                    <p style="font-size:18px; line-height:25px; margin:0; float: left">${message}</p>
                </td>
            </tr>
            <tr style="float: left;padding:0px 10px 20px 25px;">
                <td>
                    <p style="font-size:18px;line-height:25px;">Vui lòng bấm nút <span style="font-weight: 500; color: #4C5BD4;">chat ngay</span> để bắt đầu cuộc trò chuyện</p>
                </td>
            </tr>
            <tr style="float: left;padding:0px 25px 20px 25px;text-align: center;width: 100%; ">
                <td style="width: 100%; float: left; ">
                    <a href="${conversationLink}" style="width: 222px;">
                        <img src="https://ht.timviec365.vn:9002/anh_mail/bg10.png" width="222px" height="71px">
                    </a>
                </td>
            </tr>
            <tr style="height: 129px;background-image: url(https://ht.timviec365.vn:9002/anh_mail/bg7.png);background-size:100% 100%;background-repeat: no-repeat;float: left;width: 100%;">
                <td style="padding-top: 27px; padding-left: 25px">
                    <ul>
                        <li style="list-style-type: none;color: #fff;margin-bottom: 8px;">
                            <span style="font-size: 16px; line-height: 19px;">Liên hệ với chúng tôi để được hỗ trợ nhiều hơn:</span>
                        </li>
                        <li style="list-style-type: none;color: #fff;margin-bottom: 8px;">
                            <span style="font-size: 16px; line-height: 19px;">Hotline: <span style="font-weight: 500; padding-left: 10px;">1900633682</span> - Ấn phím 1</span>
                        </li>
                        <li style="list-style-type: none;color: #fff;margin-bottom: 5px;">
                            <span style="font-size: 16px; line-height: 19px;">Trân trọng !</span>
                        </li>
                    </ul>
                </td>
        </table>
    </body>
    </html>
  `
    const mail_config = {
      from: 'admin@doithe247.com',
      to: receiver,
      subject: 'Thông báo tin nhắn',
      html: content
    };

    transporter_zoho.sendMail(mail_config, function (error, info) {
      if (error) {
        console.log(error);
        return ({ message: "Đã có lỗi xảy ra khi gửi mail" });
      };
      return resolve({ message: "Gửi mail thành công" })
    });
  }
  catch (e) {
    console.log('Loi gui mail', e);
  }
}
let flagCheckMail = 0;
export const sendNotificationToTimViec = (message, conversationName, conversationId, listmember, isOnline, isGroup, flag) => {
  try {
    let mess = "";
    if (message.MessageType == "sendFile") {
      mess = "Tệp";
    }
    else if (message.MessageType == "sendProfile") {
      mess = "Thẻ Liên Hệ";
    }
    else if (message.MessageType == "sendPhoto") {
      mess = "Ảnh";
    }
    else {
      mess = message.Message;
    }
    User.find({ _id: Number(message.SenderID) }, { userName: 1, email: 1 }).limit(1).then(async (user) => {
      if (user) {
        if (user.length && user[0].userName && user[0]._id) {
          socket.emit("SendNotificationToHHP", mess, user[0].userName, conversationId, user[0].userName, message.SenderID, listmember.find(e => Number(e) != Number(message.SenderID)));

          if (flagCheckMail != Number(new Date().getDate())) {
            let listMember = listmember.filter(e => Number(e) != Number(message.SenderID));
            let newListMem = [];
            for (let i = 0; i < listMember.length; i++) {
              if (!isNaN(listMember[i])) {
                newListMem.push(Number(listMember[i]))
              }
            }
            let listDataMem = await User.find({ _id: { $in: newListMem } }, { email: 1, companyId: 1 }).limit(200).lean();
            if (listDataMem) {
              if (listDataMem.length) {
                for (let i = 0; i < listDataMem.length; i++) {
                  if (isNaN(listDataMem[i].email) && (!listDataMem[i].isOnline)) {
                    if (listDataMem[i].companyId == 3312) {
                      let today = `${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}`;
                      FirstMessageDay.find({ time: today, userId: listDataMem[i]._id }).limit(1).then(async (check) => {
                        if (check) {
                          if (!check.length) {
                            sendMail(user[0].userName, mess, listDataMem[i].email, conversationId)
                            let newData = new FirstMessageDay({
                              userId: listDataMem[i]._id,
                              time: today
                            });
                            await newData.save();
                          }
                        }
                      }).catch((e1) => { console.log(e1) });
                      FirstMessageDay.deleteMany({ time: { $ne: today } }).catch((e2) => { console.log(e) })
                    }
                  }
                }
              }
            };
          };
        };
      };
      return true;
    }).catch((e) => {
      console.log(e);
      return false
    })
  }
  catch (e) {
    console.log(e);
    return false;
  }
}


const ConvertToObject = (string) => {
  let stringObject = string.replace(/{|}|"/g, '');
  let obj = {};
  let stringKeyValueArr = stringObject.split(",")
  for (let i = 0; i < stringKeyValueArr.length; i++) {
    obj[`${stringKeyValueArr[i].split(":")[0]}`] = `${stringKeyValueArr[i].slice(stringKeyValueArr[i].split(":")[0].length + 1, stringKeyValueArr[i].length).trim()}`
  }
  return obj
}
const ConvertToObjectQuote = (string) => {
  let stringObject = string.replace(/{|}|"/g, '');

  let obj = {};
  let stringKeyValueArr = stringObject.split(",")
  console.log(stringKeyValueArr)

  // for (let i = 4; i < stringKeyValueArr.length - 2; i++) {
  //   stringKeyValueArr[4] = stringKeyValueArr[4] + "," + stringKeyValueArr[i + 1]
  // }
  // for (let i = 4; i < stringKeyValueArr.length - 2; i++) {
  //   stringKeyValueArr.splice(i + 1, 1)
  // }

  for (let i = 0; i < stringKeyValueArr.length; i++) {
    obj[`${stringKeyValueArr[i].split(":")[0]}`] = `${stringKeyValueArr[i].slice(stringKeyValueArr[i].split(":")[0].length + 1, stringKeyValueArr[i].length).trim()}`
  }
  return obj
}
const ConvertToArrayObject = (string) => {
  let stringObject = string.replace("]", '').replace("[", '');
  let stringArrayObject = stringObject.split("},{")
  let arrayObject = [];
  for (let i = 0; i < stringArrayObject.length; i++) {
    arrayObject.push(ConvertToObject(stringArrayObject[i]));
  }
  return arrayObject
}
const MarkUnreaderMessage = (ConversationID, SenderID, listMember) => {
  let listCheck = listMember.filter((e) => Number(e) != Number(SenderID));
  FReadMessage({
    body: {
      conversationId: ConversationID,
      senderId: SenderID,
    }
  })
  Conversation.updateOne(
    {
      _id: Number(ConversationID),
      "memberList.memberId": { $in: listCheck }
    },
    {
      $set: { "memberList.$[elem].unReader": 1 }
    },
    {
      multi: true,
      arrayFilters: [{ "elem.memberId": { $in: listCheck } }]
    }
  ).catch(function (err) {
    console.log(err);
  });
  Conversation.updateOne(
    {
      _id: Number(ConversationID),
      "memberList.memberId": Number(SenderID)
    },
    {
      $set: {
        listDeleteMessageOneSite: [],
        "memberList.$.timeLastSeener": new Date()
      }
    }
  ).catch(function (err) {
    console.log(err);
  });
  return true;
}

const AddFriend = async (userId, contactId) => {
  try {
    let checkContact = await Contact.find({
      $or: [
        { userFist: Number(userId), userSecond: Number(contactId) },
        { userFist: Number(contactId), userSecond: Number(userId) }
      ]
    }).limit(1).lean();
    if (Number(checkContact.length) === 0) {
      let newContact = new Contact({
        userFist: userId,
        userSecond: contactId
      });
      await newContact.save();
      return true;
    }
    else {
      return false;
    }
  }
  catch (e) {
    console.log("Error when add friend createNewLivwChat", e);
    return false;
  }
}

export const SetIpSpam = async (req, res, next) => {
  try {
    const Ip = req.body.Ip
    let input = fs.readFileSync('utils/ListIpSpam.txt', 'utf8')
    input = input.trim() == '' ? JSON.stringify([]) : input
    const listIp = JSON.parse(input)
    listIp.push(Ip)
    const output = JSON.stringify(listIp)
    fs.writeFileSync('utils/ListIpSpam.txt', output)

    res.json({
      data: {
        result: true,
        message: 'Thêm thành công',
      },
      error: null
    })
  } catch (err) {
    console.log(err);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

const TestTwoLink = (str) => {
  try {
    if (str.split('http:').length > 2) {
      return true
    }
    else if (str.split('https:').length > 2) {
      return true;
    }
    return false;
  }
  catch (e) {
    return false
  }
}


let listConvTestLiveChatV2 = [244333, 240314, 245494];
let listIpBaned = ["14.243.32.223","14.236.151.196"]
const listIp = ["128.199.73.25", "103.214.10.253", "103.45.229.175","14.236.151.196","74.119.194.109"]
export const SendMessage = async (req, res) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.SenderID)) {
        console.log("Token hop le, SendMessage")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
  
    if (req.body && req.body.ConversationID && (!isNaN(req.body.ConversationID)) && req.body.SenderID && (!isNaN(req.body.SenderID))) {
      let listOnline = [];
      // socket.emit("GetOnline", "chat365")
      // socket.on("GetOnline", (data) => {
      //   listOnline = data
      // })
      let ConversationID = Number(req.body.ConversationID);
      let SenderID = Number(req.body.SenderID);
      let Message = req.body.Message ? String(req.body.Message) : "";
      let Quote = req.body.Quote ? String(req.body.Quote) : "";
      let Profile = req.body.Profile ? String(req.body.Profile) : "";
      let ListTag = req.body.ListTag ? String(req.body.ListTag) : "";
      let ListMember = req.body.ListMember ? JSON.parse(req.body.ListMember) : [];
      let IsOnline = req.body.IsOnline ? String(req.body.IsOnline) : "";
      let conversationName = req.body.conversationName ? String(req.body.conversationName) : "";
      let isGroup = (req.body.isGroup && (!isNaN(req.body.isGroup))) ? Number(req.body.isGroup) : 0;
      let deleteTime = (req.body.deleteTime && (!isNaN(req.body.deleteTime))) ? Number(req.body.deleteTime) : 0;
      let deleteType = (req.body.deleteType && (!isNaN(req.body.deleteType))) ? Number(req.body.deleteType) : 0;
      let liveChat = req.body.liveChat ? String(req.body.liveChat) : null;
      let infoSupport = req.body.InfoSupport ? String(req.body.InfoSupport) : null;
      let timeLivechat = req.body.TimeLiveChat ? req.body.TimeLiveChat : null;
      let uscid = req.body.uscid ? req.body.uscid : ''
      let isSecret = req.body.isSecret ? Number(req.body.isSecret) : 0

      // add friend ntd with uv. 
      if (req.body.ContactId) {
        AddFriend(Number(req.body.SenderID), Number(req.body.ContactId));
      }
      if (req.body.MessageType && (req.files|| req.body.Message || req.body.Quote)) {
        // let finduser = User.findOne({_id:SenderId})
        let MessageType = String(req.body.MessageType);
        let mess = {};
        mess.MessageID = "";
        if (req.body.MessageID && (req.body.MessageID.trim() != "")) {
          mess.MessageID = req.body.MessageID;
        }
        else {
          mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000000 + 8}_${SenderID}`;
        }
        mess.CreateAt = `${JSON.parse(JSON.stringify(new Date(new Date().setHours(new Date().getHours() + 7)))).replace("Z", "")}+07:00`;
        
        mess.ConversationID = ConversationID;
        mess.SenderID = SenderID;
        mess.MessageType = MessageType;
        mess.Message = Message;
        mess.ListTag = ListTag;
        mess.DeleteTime = deleteTime;
        mess.DeleteType = deleteType;
        mess.DeleteDate = String('0001-01-01T00:00:00.000+00:00');
        mess.IsFavorite = 0;
        mess.uscid = uscid
        mess.isSecret = isSecret
        mess.linkNotification = req.body.link || req.body.Link || req.body.linkNotification || null

        if (isGroup == 0) {
          const receivedId = ListMember.find(member => member !== SenderID)
          const companyIdReceive = req.body.companyIdReceive ? Number(req.body.companyIdReceive) : 0
          const [listConvStrange, lastConvStrange] = await FGetListConversationIdStrange(receivedId, companyIdReceive)

          mess.strange = [
            {
              userId: receivedId,
              status: 1
            },
            {
              userId: SenderID,
              status: listConvStrange.includes(ConversationID) ? 0 : 1
            }
          ]
        }

        if (!req.body.Quote || (String(req.body.Quote).trim() == "") || (String(req.body.Quote) == "null")) {
          mess.QuoteMessage = MessageQuote("", "", 0, "", "", `${JSON.parse(JSON.stringify(new Date())).replace("Z", "")}6769+07:00`);
        }
        else {
          mess.QuoteMessage = ConvertToObjectQuote(req.body.Quote);
          mess.QuoteMessage.SenderID = Number(mess.QuoteMessage.SenderID);
        }

        if (req.files ) {
          mess.ListFile = req.files;
          for (let i = 0; i < mess.ListFile.length; i++) {
            if (mess.ListFile[i].filename ) {
              mess.ListFile[i].filename = mess.ListFile[i].filename.replace(/[ +!@#$%^&*]/g, '');
              mess.ListFile[i].filename = `http://localhost:9000/fileupload/${mess.ListFile[i].filename}`
            }
            else {
              mess.ListFile[i].filename = "";
            }

              mess.ListFile[i].Height = 10;
            
              mess.ListFile[i].Width = 10;

            if ((!isNaN(mess.ListFile[i].size))) {
              mess.ListFile[i].size = Number(mess.ListFile[i].size);
            }
            else {
              mess.ListFile[i].size = 10;
            };
            // console.log("Obj file sau khi sua:0",mess.ListFile[i])
          };
          // console.log(mess.ListFile)
        }
        else {
          mess.ListFile = null;
        }
        if (req.body.Profile && (String(req.body.Profile) != "null")) {
          let obj = ConvertToObject(req.body.Profile);
          mess.Message = obj.id;
          mess.UserProfile = {};
          mess.UserProfile.AcceptMessStranger = Number(obj.acceptMessStranger)
          mess.UserProfile.Active = Number(obj.active)
          mess.UserProfile.AvatarUser = obj.avatarUser;
          mess.UserProfile.CompanyId = Number(obj.companyId)
          mess.UserProfile.CompanyName = obj.companyName;
          mess.UserProfile.Email = obj.email;
          mess.UserProfile.FriendStatus = obj.friendStatus;
          mess.UserProfile.FromWeb = obj.fromWeb;
          mess.UserProfile.ID = Number(obj.id)
          mess.UserProfile.ID365 = (!isNaN(obj.iD365)) ? Number(obj.iD365) : 0;
          mess.UserProfile.IDTimViec = Number(obj.idTimViec)
          mess.UserProfile.LastActive = `${JSON.parse(JSON.stringify(new Date(new Date().setHours(new Date().getHours() + 7)))).replace("Z", "")}+07:00`;
          mess.UserProfile.LinkAvatar = obj.avatarUser;
          mess.UserProfile.Looker = Number(obj.looklooker)
          mess.UserProfile.NotificationAcceptOffer = 1;
          mess.UserProfile.NotificationAllocationRecall = 1;
          mess.UserProfile.NotificationCalendar = 1;
          mess.UserProfile.NotificationChangeProfile = 1;
          mess.UserProfile.NotificationChangeSalary = 1;
          mess.UserProfile.NotificationCommentFromRaoNhanh = 1;
          mess.UserProfile.NotificationCommentFromTimViec = 1;
          mess.UserProfile.NotificationDecilineOffer = 1;
          mess.UserProfile.NotificationMissMessage = 1;
          mess.UserProfile.NotificationNTDApplying = 0;
          mess.UserProfile.NotificationNTDExpiredPin = 1;
          mess.UserProfile.NotificationNTDExpiredRecruit = 1;
          mess.UserProfile.NotificationNTDPoint = 1;
          mess.UserProfile.NotificationNewPersonnel = 1;
          mess.UserProfile.NotificationOffer = 1;
          mess.UserProfile.NotificationPayoff = 1;
          mess.UserProfile.NotificationPersonnelChange = 1;
          mess.UserProfile.NotificationReport = 1;
          mess.UserProfile.NotificationRewardDiscipline = 1;
          mess.UserProfile.NotificationSendCandidate = 1;
          mess.UserProfile.NotificationTag = 1;
          mess.UserProfile.NotificationTransferAsset = 1;
          mess.UserProfile.Password = obj.password;
          mess.UserProfile.Phone = obj.phone;
          mess.UserProfile.Status = obj.status;
          mess.UserProfile.StatusEmotion = Number(obj.statusEmotion);
          mess.UserProfile.Type365 = Number(obj.type365);
          mess.UserProfile.Type_Pass = Number(obj.type_Pass);
          mess.UserProfile.UserName = obj.userName;
          mess.UserProfile.isOnline = Number(obj.isOnline);
          mess.UserProfile.secretCode = obj.secretCode;
          mess.UserProfile.userQr = obj.userQr;
          mess.UserProfile.Looker = 0;
        }
        else {
          mess.UserProfile = {};
          mess.UserProfile.AcceptMessStranger = 0
          mess.UserProfile.Active = 0
          mess.UserProfile.AvatarUser = null;
          mess.UserProfile.CompanyId = 0
          mess.UserProfile.CompanyName = null;
          mess.UserProfile.Email = null;
          mess.UserProfile.FriendStatus = null;
          mess.UserProfile.FromWeb = null;
          mess.UserProfile.ID = 0
          mess.UserProfile.ID365 = 0
          mess.UserProfile.IDTimViec = 0
          mess.UserProfile.LastActive = `${JSON.parse(JSON.stringify(new Date(new Date().setHours(new Date().getHours() + 7)))).replace("Z", "")}+07:00`;
          mess.UserProfile.LinkAvatar = null;
          mess.UserProfile.Looker = 0
          mess.UserProfile.NotificationAcceptOffer = 0;
          mess.UserProfile.NotificationAllocationRecall = 0;
          mess.UserProfile.NotificationCalendar = 0;
          mess.UserProfile.NotificationChangeProfile = 0;
          mess.UserProfile.NotificationChangeSalary = 0;
          mess.UserProfile.NotificationCommentFromRaoNhanh = 0;
          mess.UserProfile.NotificationCommentFromTimViec = 0;
          mess.UserProfile.NotificationDecilineOffer = 0;
          mess.UserProfile.NotificationMissMessage = 0;
          mess.UserProfile.NotificationNTDApplying = 0;
          mess.UserProfile.NotificationNTDExpiredPin = 0;
          mess.UserProfile.NotificationNTDExpiredRecruit = 0;
          mess.UserProfile.NotificationNTDPoint = 0;
          mess.UserProfile.NotificationNewPersonnel = 0;
          mess.UserProfile.NotificationOffer = 0;
          mess.UserProfile.NotificationPayoff = 1;
          mess.UserProfile.NotificationPersonnelChange = 0;
          mess.UserProfile.NotificationReport = 0;
          mess.UserProfile.NotificationRewardDiscipline = 0;
          mess.UserProfile.NotificationSendCandidate = 0;
          mess.UserProfile.NotificationTag = 0;
          mess.UserProfile.NotificationTransferAsset = 0;
          mess.UserProfile.Password = null;
          mess.UserProfile.Phone = null;
          mess.UserProfile.Status = null;
          mess.UserProfile.StatusEmotion = 0;
          mess.UserProfile.Type365 = 0;
          mess.UserProfile.Type_Pass = 0;
          mess.UserProfile.UserName = null;
          mess.UserProfile.isOnline = 0;
          mess.UserProfile.secretCode = null;
          mess.UserProfile.userQr = null;
        }

        // sendProfile if have sdt 
        if (String(req.body.messageType == "text") && checkPhoneNumberInMessage(Message) != null) {
          let obj = {}
          let finduser = await User.findOne({ email: checkPhoneNumberInMessage(Message) }).lean()
          if (finduser) {
            obj.Message = finduser.id;
            obj = {};
            obj.acceptMessStranger = Number(finduser.acceptMessStranger)
            obj.active = Number(finduser.active)
            obj.avatarUser = finduser.avatarUser;
            obj.companyId = Number(finduser.companyId)
            obj.companyName = finduser.companyName;
            obj.email = finduser.email;
            obj.friendStatus = 0
            obj.fromWeb = finduser.fromWeb;
            obj.id = Number(finduser._id)
            obj.iD365 = (!isNaN(finduser.id365)) ? Number(finduser.id365) : 0;
            obj.idTimViec = Number(finduser.idTimViec)
            obj.LastActive = `${JSON.parse(JSON.stringify(new Date(new Date().setHours(new Date().getHours() + 7)))).replace("Z", "")}+07:00`;
            obj.avatarUser = finduser.avatarUser;
            obj.Looker = 0
            obj.NotificationAcceptOffer = 1;
            obj.NotificationAllocationRecall = 1;
            obj.NotificationCalendar = 1;
            obj.NotificationChangeProfile = 1;
            obj.NotificationChangeSalary = 1;
            obj.NotificationCommentFromRaoNhanh = 1;
            obj.NotificationCommentFromTimViec = 1;
            obj.NotificationDecilineOffer = 1;
            obj.NotificationMissMessage = 1;
            obj.NotificationNTDApplying = 0;
            obj.NotificationNTDExpiredPin = 1;
            obj.NotificationNTDExpiredRecruit = 1;
            obj.NotificationNTDPoint = 1;
            obj.NotificationNewPersonnel = 1;
            obj.NotificationOffer = 1;
            obj.NotificationPayoff = 1;
            obj.NotificationPersonnelChange = 1;
            obj.NotificationReport = 1;
            obj.NotificationRewardDiscipline = 1;
            obj.NotificationSendCandidate = 1;
            obj.NotificationTag = 1;
            obj.NotificationTransferAsset = 1;
            obj.password = finduser.password;
            obj.phone = finduser.phone;
            obj.status = finduser.status;
            obj.statusEmotion = 0
            obj.type365 = Number(finduser.type365);
            obj.type_Pass = 0
            obj.userName = finduser.userName;
            obj.isOnline = Number(finduser.isOnline);
            obj.secretCode = finduser.secretCode;
            obj.userQr = finduser.userQr;
            FSendMessage({
              body: {
                ConversationID: ConversationID,
                SenderID: SenderID,
                MessageType: "sendProfile",
                Message: finduser._id,
                Profile: obj,
                ListMember: JSON.stringify(ListMember),
                companyIdReceive: req.body.companyIdReceive ? req.body.companyIdReceive : 0
              }
            }).catch((e) => {
              console.log("error when send profile internal message", e)
            })
          }
        }

        if (mess.DeleteType == 0 && mess.DeleteTime > 0) {
          // mess.DeleteDate = (new Date()).setSeconds(new Date().getSeconds() + Number(deleteTime));
          const time = new Date()
          time.setSeconds(time.getSeconds() + Number(deleteTime))
          time.setHours(time.getHours() + 7)
          mess.DeleteDate = time
        }


        let listMember = [];
        let isOnline = [];

        let conversation = await Conversation.findOne({ _id: ConversationID }, { adminId: 1, "memberList.memberId": 1, "memberList.conversationName": 1, "memberList.liveChat": 1, "memberList.notification": 1, "memberList.deleteTime": 1, typeGroup: 1, isGroup: 1, IdCustomer: 1 }).lean();
        if (conversation) {
          conversationName = conversation.memberList.find((e) => e.memberId == SenderID).conversationName;
          if (conversation && conversation.memberList) {
            for (let i = 0; i < conversation.memberList.length; i++) {
              listMember.push(conversation.memberList[i].memberId);
              isOnline.push(1);
            }
          }
          if (!listMember.find((e) => e == SenderID)) {
            return false
          }


            // console.log("send message normaly")
            sendNotificationToTimViec(mess, conversationName, mess.ConversationID, listMember, isOnline, isGroup, true);
            if (MessageType != "link") {
              if (!mess.Message) {
                mess.Message = req.body.Message;
              };
              if (req.body.from && (req.body.from == "Chat Winform")) {
                if (MessageType == "sendFile" || MessageType == "sendPhoto") {
                  console.log("k ban socket vi api upload file da co")
                }
                else {
                  if (MessageType == "OfferReceive" || MessageType == "applying") {
                    mess.link = req.body.Link;
                  };
                  socket.emit("SendMessage", mess, listMember);
                  SendMessageMqtt(listMember, mess);
                }
              }
              else {
                if (MessageType == "OfferReceive" || MessageType == "applying") {
                  mess.link = req.body.Link;
                }
                socket.emit("SendMessage", mess, listMember);
                SendMessageMqtt(listMember, mess);
              }

              if (MessageType == "sendFile" || MessageType == "sendPhoto" || MessageType == "sendVoice" || MessageType == "sendCv") {
                console.log(req.files)
                let findSend = [];
                for (let i = 0; i < mess.ListFile.length; i++) {
                  findSend.push(FileSendDB((!isNaN(mess.ListFile[i].SizeFile)) ? Number(mess.ListFile[i].SizeFile) : 100,String(mess.ListFile[i].filename) , Number(mess.ListFile[i].Height), Number(mess.ListFile[i].Width), String(mess.ListFile[i].originalname)))
                };
           
                Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                  if (counter && counter.length > 0 && counter[0].countID) {
                    const filter = { name: "MessageId" };
                    const update = { countID: counter[0].countID + 1 };
                    await Counter.updateOne(filter, update);
                    Conversation.updateOne({ _id: ConversationID }, {
                      $push: {
                        messageList: MessagesDB(
                          mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType,
                          mess.ListFile[0].FullName, mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0), findSend, EmotionMessageDBDefault(),
                          mess.DeleteTime, mess.DeleteType, mess.DeleteDate, [], null, uscid, isSecret)
                      },
                      $set: { timeLastMessage: new Date(mess.CreateAt) }
                    }).catch(function (err) {
                      console.log(err);
                      return false;
                    });
                    return true;
                  }
                }).catch(function (err) {
                  console.log(err);
                  return false;
                });
              }
              else if (MessageType == "map") {
                let z = mess.Message.split(",");
                let link = `https://www.google.com/maps/search/${z[0].trim()},${z[1].trim()}/${z[0].trim()},${z[1].trim()},10z?hl=vi`;
                mess.InfoLink = {};
                mess.InfoLink.HaveImage = "False";
                let index = link.indexOf("/", 9);
                if (index != -1) {
                  mess.InfoLink.LinkHome = link.slice(0, index);
                }
                else {
                  mess.InfoLink.LinkHome = link;
                }
                axios.get(link).then((doc) => {
                  if (doc && doc.data) {
                    mess.InfoLink.Title = String(doc.data).split("<title>")[1].split("</title>")[0].trim();
                    mess.InfoLink.Description = null;
                    let Image = String(doc.data).split(`property="og:image`)[0].replace(`"`, '');
                    mess.InfoLink.Image = Image.split(`<meta content=`)[Image.split(`<meta content=`).length - 1].replace('"', ``).replace('"', ``);
                    mess.InfoLink.Image = String(mess.InfoLink.Image).replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').trim();
                    if (mess.InfoLink.Image) {
                      mess.InfoLink.HaveImage = "True";
                    }
                    mess.InfoLink.MessageID = null;
                    mess.InfoLink.TypeLink = null;
                    socket.emit("SendMessage", mess, listMember);
                    // thêm dữ liệu vào base
                    Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                      if (counter && counter.length > 0 && counter[0].countID) {
                        const filter = { name: "MessageId" };
                        const update = { countID: counter[0].countID + 1 };
                        await Counter.updateOne(filter, update);
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                              mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                              infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                              mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [], null, uscid, isSecret)
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                          return false;
                        });
                      }
                    }).catch(function (err) {
                      console.log(err);
                      return false;
                    });
                  }
                }).catch((e) => {
                  console.log(e);
                  return false;
                })
              }
              else {
                Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                  if (counter && counter.length > 0 && counter[0].countID) {
                    const filter = { name: "MessageId" };
                    const update = { countID: counter[0].countID + 1 };
                    await Counter.updateOne(filter, update);
                    Conversation.updateOne({ _id: ConversationID }, {
                      $push: {
                        messageList: MessagesDB(
                          mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, Message,
                          mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0),
                          mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, [], null, uscid, isSecret)
                      },
                      $set: { timeLastMessage: new Date(mess.CreateAt) }
                    }).catch(function (err) {
                      console.log(err);
                      return false;
                    });
                    return true;
                  }
                }).catch(function (err) {
                  console.log(err);
                  return false;
                });
              }
            }
            if ((MessageType == "link") || (MessageType == "text")) {
              if (MessageType == "link") { // gửi socket 2 lần, lưu vào base 1 tin nhắn 
                socket.emit("SendMessage", mess, listMember);
                mess.InfoLink = {};
                mess.InfoLink.HaveImage = "False";
                if (String(mess.Message)[String(mess.Message).length - 1] == "/") {
                  mess.Message = String(mess.Message).slice(0, String(mess.Message).length - 1)
                };
                mess.InfoLink.linkHome = mess.Message;

                getLinkPreview(
                  `${mess.Message}`
                ).then((doc) => {
                  if (doc) {
                    mess.InfoLink.title = doc.title || "Không tìm thấy thông tin website";
                    mess.InfoLink.description = doc.description || null;
                    mess.InfoLink.image = (doc.images && (doc.images.length > 0)) ? doc.images[0] : null;
                    if (!mess.InfoLink.image) {
                      mess.InfoLink.image = "True";
                    }
                    mess.InfoLink.MessageID = null;
                    mess.InfoLink.TypeLink = null;
                    mess.InfoLink.IsNotification = 0;
                    socket.emit("SendMessage", mess, listMember);
                    // insert link to base 
                    Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                      if (counter && counter.length > 0 && counter[0].countID) {
                        const filter = { name: "MessageId" };
                        const update = { countID: counter[0].countID + 1 };
                        await Counter.updateOne(filter, update);
                        
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                              mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                              infoLink(mess.InfoLink.title, mess.InfoLink.description, mess.InfoLink.linkHome, mess.InfoLink.image, 0),
                              mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, [],)
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                          return false;
                        });
                        return true;
                      }
                    }).catch(function (err) {
                      console.log(err);
                      return false;
                    });
                    MarkUnreaderMessage(ConversationID, SenderID, listMember);
                    res.json({
                      data: {
                        message: Message,
                        messageID: mess.MessageID,
                        createAt: mess.CreateAt,
                        result: true,
                        SenderID: SenderID,
                        conversationID: ConversationID,
                        listFile: mess.ListFile,
                        infoLink: mess.InfoLink
                      },
                      error: null
                    })
                  }
                }).catch((e) => {
                  console.log('Khong lay anh xem truoc')
                })

              }
              else { // text chứa link; bắn 2 lần socket và lưu 2 tin nhắn 
                mess.InfoLink = {};
                mess.InfoLink.HaveImage = "False";
                if (!TestTwoLink(mess.Message)) {
                  let urlCheck = new RegExp("[a-zA-Z\d]+://(\w+:\w+@)?([a-zA-Z\d.-]+\.[A-Za-z]{2,4})(:\d+)?(/.*)?");
                  if (urlCheck.test(mess.Message)) {
                    let link = mess.Message.slice(mess.Message.indexOf('http'), mess.Message.length);
                    getLinkPreview(
                      `${link}`
                    ).then((doc) => {
                      if (doc) {
                        mess.InfoLink.LinkHome = doc.url;
                        mess.InfoLink.Title = doc.title;
                        mess.InfoLink.Description = doc.description || null;
                        mess.InfoLink.Image = (doc.images.length > 0) ? doc.images[0] : null;
                        if (mess.InfoLink.Image) {
                          mess.InfoLink.HaveImage = "True";
                        }
                        mess.InfoLink.MessageID = null;
                        mess.InfoLink.TypeLink = null;
                        mess.InfoLink.IsNotification = 0;
                        // bắn trc 1 socket cho bên app render 
                        mess.Message = doc.url;
                        mess.MessageType = "link";
                        mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000001 + 8}_${SenderID}`;
                        socket.emit("SendMessage", mess, listMember);
                        Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                          if (counter && counter.length > 0 && counter[0].countID) {
                            const filter = { name: "MessageId" };
                            const update = { countID: counter[0].countID + 1 };
                            await Counter.updateOne(filter, update);

                            Conversation.updateOne({ _id: ConversationID }, {
                              $push: {
                                messageList: MessagesDB(
                                  mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                  mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                  infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                  mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [], null, uscid, isSecret)
                              },
                              $set: { timeLastMessage: new Date(mess.CreateAt) }
                            }).catch(function (err) {
                              console.log(err);
                            });
                            return true;
                          }
                        }).catch(function (err) {
                          console.log(err);
                          return false;
                        });
                        MarkUnreaderMessage(ConversationID, SenderID, listMember);
                      }
                    }).catch((e) => {
                      console.log('Khong lay anh xem truocw')
                      return true
                    });
                  }
                }
              }
            }
            MarkUnreaderMessage(ConversationID, SenderID, listMember);
          
           
        
          let listUserOffline = [];
          User.find({ _id: { $in: listMember } }, { isOnline: 1, userName: 1, sharePermissionId: 1 }).then(async (listUser) => {
            if (listUser && listUser.length) {
              let senderName = listUser.find((e) => e._id == mess.SenderID) ? listUser.find((e) => e._id == mess.SenderID).userName : "";
              // customer -> ntd 
              if (conversation.isGroup == 0 && ([...new Set(listMember)].length == 2)) {
                for (let i = 0; i < listUser.length; i++) {
                  if (listUser[i]._id != SenderID) {
                  
                    if (listUser[i].sharePermissionId && listUser[i].sharePermissionId.length && !listUser[i].sharePermissionId.find((e) => e == SenderID)) {
                      let con = await Conversation.findOne(
                        {
                          adminId: listUser[i]._id,
                          isGroup: 1,
                          typeGroup: "SharePermission",
                          IdCustomer: SenderID
                        }, { _id: 1 }).lean();
                      let obj = req.body;
                      obj["FromClient"] = 'ok';
                      obj["SenderID"] = 59721;
                      if (con) {
                        // sendMessage -> Group by temp account
                        obj["ConversationID"] = con._id;
                        console.log('input', obj)
                        await axios({
                          method: "post",
                          url: "http://43.239.223.142:9000/api/message/SendMessage",
                          data: obj,
                          headers: { "Content-Type": "multipart/form-data" },
                        });
                        console.log("send successfully")
                      }
                      else {
                        // create con 
                        let memberList = [{
                          memberId: 59721,
                          notification: 1,
                          conversationName: `${senderName}-Hỗ trợ`,
                          unReader: 1,
                        },
                          // {
                          //   memberId: listUser[i]._id,
                          //   notification: 1,
                          //   conversationName:`Hỗ trợ-${senderName}`,
                          //   unReader:1,
                          // }
                        ];
                        let listUserShare = [...new Set(listUser[i].sharePermissionId)]
                        for (let i = 0; i < listUserShare.length; i++) {
                          memberList.push({
                            memberId: listUserShare[i],
                            notification: 1,
                            conversationName: `${senderName}-Hỗ trợ`,
                            unReader: 1,
                          },)
                        }
                        const bigestId = (
                          await Conversation.find().sort({ _id: -1 }).select("_id").limit(1).lean()
                        )[0]._id;
                        let newCon = new Conversation({
                          _id: bigestId + 1,
                          isGroup: 1,
                          adminId: listUser[i]._id,
                          typeGroup: "SharePermission",
                          IdCustomer: SenderID,
                          memberList: memberList,
                          messageList: [],
                          browseMemberList: [],
                          timeLastMessage: new Date(),
                          timeLastChange: new Date()
                        })
                        let savedCon = await newCon.save();
                        // send mess to group 

                        obj["ConversationID"] = savedCon._id;
                        console.log('input', obj)
                        await axios({
                          method: "post",
                          url: "http://43.239.223.142:9000/api/message/SendMessage",
                          data: obj,
                          headers: { "Content-Type": "multipart/form-data" },
                        });
                        console.log("send successfully")

                      }
                    }
                  }
                }
              }
              // supporter to customer 
              if (conversation.isGroup == 1 && (conversation.typeGroup == "SharePermission") && conversation.IdCustomer && conversation.adminId) {
                if (!req.body.FromClient) {
                  let ConId = await FCreateNewConversation(conversation.IdCustomer, conversation.adminId);
                  let obj = req.body;
                  obj["SenderID"] = conversation.adminId;
                  obj["ConversationID"] = ConId;
                  await axios({
                    method: "post",
                    url: "http://43.239.223.142:9000/api/message/SendMessage",
                    data: obj,
                    headers: { "Content-Type": "multipart/form-data" },
                  });
                  console.log("send successfully")
                }
              }
              for (let i = 0; i < listMember.length; i++) {
                let a = listUser.find((e) => e._id == listMember[i]);
                if (a) {
                  if (Number(a._id) !== SenderID) {
                    if (conversation.memberList.find((e) => e.memberId == listMember[i])) {
                      if (conversation.memberList.find((e) => e.memberId == listMember[i]).notification != 0) {
                        if ((a.isOnline) == 0 && Number(a._id) !== SenderID) {
                          listUserOffline.push(listMember[i]);
                        }
                        else if (!listOnline.find((e) => e == listMember[i])) {
                          listUserOffline.push(listMember[i]);
                        }
                      }
                    }
                  }
                }
              };
              if (listUserOffline.length) {
                if (!conversationName) {
                  conversationName = senderName;
                }
                if (req.body.MessageType == "text") {
                  axios({
                    method: "post",
                    url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                    data: {
                      IdReceiver: JSON.stringify(listUserOffline),
                      conversationId: ConversationID,
                      sendername: senderName,
                      ava: 'a',
                      mess: mess.Message,
                      type: 'text',
                      idSender: mess.SenderID,
                      mask: 1,
                      conversationName: conversationName
                    },
                    headers: { "Content-Type": "multipart/form-data" }
                  }).catch((e) => {
                    console.log(e)
                  })
                }
                else if (req.body.MessageType == "map") {
                  axios({
                    method: "post",
                    url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                    data: {
                      IdReceiver: JSON.stringify(listUserOffline),
                      conversationId: ConversationID,
                      sendername: senderName,
                      ava: 'a',
                      mess: 'Bạn đã nhận được 1 vị trí ',
                      type: 'text',
                      idSender: mess.SenderID,
                      mask: 1,
                      conversationName: conversationName
                    },
                    headers: { "Content-Type": "multipart/form-data" }
                  }).catch((e) => {
                    console.log(e)
                  })
                }
                else if (req.body.MessageType == "sendProfile") {
                  axios({
                    method: "post",
                    url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                    data: {
                      IdReceiver: JSON.stringify(listUserOffline),
                      conversationId: ConversationID,
                      sendername: senderName,
                      ava: 'a',
                      mess: 'Bạn đã nhận được 1 thẻ liên hệ',
                      type: 'text',
                      idSender: mess.SenderID,
                      mask: 1,
                      conversationName: conversationName
                    },
                    headers: { "Content-Type": "multipart/form-data" }
                  }).catch((e) => {
                    console.log(e)
                  })
                }
                else if (req.body.MessageType == "sendFile") {
                  axios({
                    method: "post",
                    url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                    data: {
                      IdReceiver: JSON.stringify(listUserOffline),
                      conversationId: ConversationID,
                      sendername: senderName,
                      ava: 'a',
                      mess: 'Bạn đã nhận được 1 file',
                      type: 'text',
                      idSender: mess.SenderID,
                      mask: 1,
                      conversationName: conversationName
                    },
                    headers: { "Content-Type": "multipart/form-data" }
                  }).catch((e) => {
                    console.log(e)
                  })
                }
                else if (req.body.MessageType == "notification") {
                  let mess_text = mess.Message;
                  if (mess_text.includes('was add friend to')) {
                    let name_user_first = listUser.find((e) => e._id == mess.SenderID).userName || "Người dùng Chat365";
                    let name_user_second = listUser.find((e) => e._id != mess.SenderID).userName || "Người dùng Chat365"
                    mess_text = `${name_user_first} đã gửi lời mời kết bạn đến ${name_user_second}`
                  }
                  axios({
                    method: "post",
                    url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                    data: {
                      IdReceiver: JSON.stringify(listUserOffline),
                      conversationId: ConversationID,
                      sendername: senderName,
                      ava: 'a',
                      mess: mess_text,
                      type: 'text',
                      idSender: mess.SenderID,
                      mask: 1,
                      conversationName: conversationName
                    },
                    headers: { "Content-Type": "multipart/form-data" }
                  }).catch((e) => {
                    console.log(e)
                  })
                }
                else {
                  axios({
                    method: "post",
                    url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                    data: {
                      IdReceiver: JSON.stringify(listUserOffline),
                      conversationId: ConversationID,
                      sendername: senderName,
                      ava: 'a',
                      mess: mess.Message,
                      type: 'text',
                      idSender: mess.SenderID,
                      mask: 1,
                      conversationName: conversationName
                    },
                    headers: { "Content-Type": "multipart/form-data" }
                  }).catch((e) => {
                    console.log(e)
                  })
                }
              }
            };
            
            if(MessageType && MessageType !== "link"){
              res.json({
                data: {
                  message: Message,
                  messageID: mess.MessageID,
                  createAt: mess.CreateAt,
                  result: true,
                  SenderID: SenderID,
                  conversationID: ConversationID,
                  listFile: mess.ListFile,
                },
                error: null
              })
            }
          
            return true;
          }).catch((e) => {
            console.log(e);
            return false;
          })
        }
        return true;
        
      }
      else {
        return res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
      };
      return true;
    }
    else {
      return res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  }
  catch (e) {
    console.log(e);
    return res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

const checkOnline = async (userId) => {
  try {
    let userfind = await User.findOne({ _id: userId }, { isOnline: 1 }).lean();
    if (userfind) {
      if (Number(userfind.isOnline) != 0) {
        return 1;
      }
      else {
        let listOnline = await axios.get('http://43.239.223.142:3000/takelistuseronline');
        listOnline = listOnline.data.listOnline;
        if (listOnline.find((e) => e == userId)) {
          return 1;
        }
        else {
          return 0;
        }
      }
    }
    else {
      return 0
    }
  }
  catch (e) {
    console.log(e);
    return 0;
  }
}

let listSpamSendMess_v2 = [];
export const SendMessage_v2 = async (req, res) => {
  try {
    console.log('Ip', req.socket.remoteAddress);
    if (listSpamSendMess_v2.find((e) => e == req.socket.remoteAddress)) {
      console.log('spam')
      return res.json({
        data: {
          countMessage: 0,
          listMessages: null,
          message: "Gửi thành công",
          messageId: "",
          createAt: new Date(),
          message_info: null,
          result: true,
          senderName: "Hỗ trợ khách hàng"
        },
        error: null
      })
    }
    if (req.body.ConversationID && (Number(req.body.ConversationID) == -1)) { return false; }

    //console.log(req.body)
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.SenderID)) {
        console.log("Token hop le, SendMessage_v2")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    // console.log(req.body)
    if (req.body && req.body.SenderID && (!isNaN(req.body.SenderID))) {
      let fagCheckConditionSend = 1;
      let Message = req.body.Message ? String(req.body.Message) : "";
      let ListTag = req.body.ListTag ? String(req.body.ListTag) : "";
      let conversationName = req.body.conversationName ? String(req.body.conversationName) : "";
      let isGroup = (req.body.isGroup && (!isNaN(req.body.isGroup))) ? Number(req.body.isGroup) : 0;
      let deleteTime = (req.body.deleteTime && (!isNaN(req.body.deleteTime))) ? Number(req.body.deleteTime) : 0;
      let deleteType = (req.body.deleteType && (!isNaN(req.body.deleteType))) ? Number(req.body.deleteType) : 0;

      let liveChat = req.body.liveChat ? String(req.body.liveChat) : null;
      let LiveChat = req.body.LiveChat ? String(req.body.LiveChat) : null;
      let infoSupport = req.body.InfoSupport ? String(req.body.InfoSupport) : null;
      let ConversationID = 0;

      let SenderID = Number(req.body.SenderID);
      let ContactId;
      if (req.body.ContactId) {
        ContactId = await takeIdFromId365(Number(req.body.ContactId));
        ConversationID = await FCreateNewConversation(SenderID, ContactId)

        let onlineStatus = await checkOnline(ContactId);
        if (onlineStatus == 0) {
          fagCheckConditionSend = 0;
          let count = 0;
          let flagSend = 1;
          let IntervalCheck = setInterval(async () => {
            if (count < 8) {
              count = count + 1;
              let checkOnlineStatus2 = await checkOnline(ContactId);
              if (checkOnlineStatus2 != 0) {
                if (flagSend == 1) {
                  await axios({
                    method: "post",
                    url: "http://43.239.223.142:9000/api/message/SendMessage_v2",
                    data: req.body,
                    headers: { "Content-Type": "multipart/form-data" }
                  });
                  flagSend = 0;
                  clearInterval(IntervalCheck);
                }
              }
            }
            else {
              let listOnline = await axios.get('http://43.239.223.142:3000/takelistuseronline');
              listOnline = listOnline.data.listOnline;
              let liveChatData = JSON.parse(req.body.LiveChat);
              if (liveChatData.FromConversation) {
                if (listOnline.find((e) => e == ContactId)) {
                  if (flagSend == 1) {
                    await axios({
                      method: "post",
                      url: "http://43.239.223.142:9000/api/message/SendMessage_v2",
                      data: req.body,
                      headers: { "Content-Type": "multipart/form-data" }
                    });
                    flagSend = 0;
                  }
                }
                else {
                  if (flagSend == 1) {
                    await axios({
                      method: "post",
                      url: "http://43.239.223.142:9000/api/message/SendMessage_v2",
                      data: {
                        SenderID: Number(liveChatData.ClientId.split("_")[0]),
                        ConversationID: Number(liveChatData.FromConversation),
                        MessageType: req.body.MessageType || "text",
                        Message: req.body.Message,
                        LiveChat: req.body.LiveChat,
                        InfoSupport: req.body.InfoSupport,
                        MessageInforSupport: req.body.MessageInforSupport
                      },
                      headers: { "Content-Type": "multipart/form-data" }
                    });
                    flagSend = 0;
                  }
                }
              } else {
                console.log("Failed send message to origin group when supporter is not online")
              }
              clearInterval(IntervalCheck);
            }
          }, 1000);
        }

        // khi khách hàng và chuyên viên có cuộc trò chuyện trước đó rồi mà khách hàng đăng nhập lại, thay vì gửi tin nhắn dạng livechat thì nó lại nhắn thẳng đến cho người ý 
        if ((Number(req.body.ContactId) == 12483) || (Number(req.body.ContactId) == 5683)) {
          if (req.body.LiveChat) {
            let liveChatData = JSON.parse(req.body.LiveChat);
            let userIdClient = Number(liveChatData.ClientId.split("_")[0])
            const checkConversation = await Conversation.findOne({
              $and: [
                { "memberList.memberId": { $eq: userIdClient } },
                { "memberList.memberId": { $eq: ContactId } },
              ],
              memberList: { $size: 2 },
              isGroup: 1,
              typeGroup: "liveChatV2"
            });
            if (checkConversation) {
              ConversationID = Number(checkConversation._id);
              SenderID = userIdClient;
              Message = req.body.MessageInforSupport;
              liveChat = null;
              LiveChat = null;
              infoSupport = null;

            }
          }
        }
      }

      if (req.body.ConversationID) {
        ConversationID = Number(req.body.ConversationID);
      };
      if (fagCheckConditionSend == 1) {
        if (req.body.MessageType && (req.body.File || req.body.Message || req.body.Quote)) {
          let MessageType = String(req.body.MessageType);
          let mess = {};
          mess.MessageID = "";
          if (req.body.MessageID && (req.body.MessageID.trim() != "")) {
            mess.MessageID = req.body.MessageID;
          }
          else {
            mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000000 + 8}_${SenderID}`;
          }
          mess.CreateAt = `${JSON.parse(JSON.stringify(new Date(new Date().setHours(new Date().getHours() + 7)))).replace("Z", "")}+07:00`;
          res.json({
            data: {
              countMessage: 0,
              listMessages: null,
              message: "Gửi thành công",
              messageId: mess.MessageID,
              createAt: mess.CreateAt,
              message_info: null,
              result: true,
              senderName: "Hỗ trợ khách hàng"
            },
            error: null
          })

          mess.ConversationID = ConversationID;
          mess.SenderID = SenderID;
          mess.MessageType = MessageType;
          mess.Message = Message;
          mess.ListTag = ListTag;
          mess.DeleteTime = deleteTime;
          mess.DeleteType = deleteType;
          mess.DeleteDate = String('0001-01-01T00:00:00.000+00:00');
          mess.IsFavorite = 0;
          if (!req.body.Quote || (String(req.body.Quote).trim() == "") || (String(req.body.Quote) == "null")) {
            mess.QuoteMessage = MessageQuote("", "", 0, "", "", `${JSON.parse(JSON.stringify(new Date())).replace("Z", "")}6769+07:00`);
          }
          else {
            mess.QuoteMessage = ConvertToObject(req.body.Quote);
            mess.QuoteMessage.SenderID = Number(mess.QuoteMessage.SenderID);
          }

          if (req.body.File && (String(req.body.File) != "null")) {
            mess.ListFile = ConvertToArrayObject(req.body.File);
            for (let i = 0; i < mess.ListFile.length; i++) {
              if ((!isNaN(mess.ListFile[i].Height))) {
                mess.ListFile[i].Height = Number(mess.ListFile[i].Height);
              }
              else {
                mess.ListFile[i].Height = 10;
              }
              if ((!isNaN(mess.ListFile[i].Width))) {
                mess.ListFile[i].Width = Number(mess.ListFile[i].Width);
              }
              else {
                mess.ListFile[i].Width = 10;
              };
              if ((!isNaN(mess.ListFile[i].SizeFile))) {
                mess.ListFile[i].SizeFile = Number(mess.ListFile[i].SizeFile);
              }
              else {
                mess.ListFile[i].SizeFile = 10;
              };
              if (mess.ListFile[i].FullName == 'null') {
                mess.ListFile[i].FullName = mess.ListFile[i].NameDisplay;
              }
            };
            // console.log(mess.ListFile)
          }
          else {
            mess.ListFile = null;
          }


          if (req.body.Profile && (String(req.body.Profile) != "null")) {
            let obj = ConvertToObject(req.body.Profile);
            mess.Message = obj.id;
            mess.UserProfile = {};
            mess.UserProfile.AcceptMessStranger = Number(obj.acceptMessStranger)
            mess.UserProfile.Active = Number(obj.active)
            mess.UserProfile.AvatarUser = obj.avatarUser;
            mess.UserProfile.CompanyId = Number(obj.companyId)
            mess.UserProfile.CompanyName = obj.companyName;
            mess.UserProfile.Email = obj.email;
            mess.UserProfile.FriendStatus = obj.friendStatus;
            mess.UserProfile.FromWeb = obj.fromWeb;
            mess.UserProfile.ID = Number(obj.id)
            mess.UserProfile.ID365 = (!isNaN(obj.iD365)) ? Number(obj.iD365) : 0;
            mess.UserProfile.IDTimViec = Number(obj.idTimViec)
            mess.UserProfile.LastActive = `${JSON.parse(JSON.stringify(new Date(new Date().setHours(new Date().getHours() + 7)))).replace("Z", "")}+07:00`;
            mess.UserProfile.LinkAvatar = obj.avatarUser;
            mess.UserProfile.Looker = Number(obj.looklooker)
            mess.UserProfile.NotificationAcceptOffer = 1;
            mess.UserProfile.NotificationAllocationRecall = 1;
            mess.UserProfile.NotificationCalendar = 1;
            mess.UserProfile.NotificationChangeProfile = 1;
            mess.UserProfile.NotificationChangeSalary = 1;
            mess.UserProfile.NotificationCommentFromRaoNhanh = 1;
            mess.UserProfile.NotificationCommentFromTimViec = 1;
            mess.UserProfile.NotificationDecilineOffer = 1;
            mess.UserProfile.NotificationMissMessage = 1;
            mess.UserProfile.NotificationNTDApplying = 0;
            mess.UserProfile.NotificationNTDExpiredPin = 1;
            mess.UserProfile.NotificationNTDExpiredRecruit = 1;
            mess.UserProfile.NotificationNTDPoint = 1;
            mess.UserProfile.NotificationNewPersonnel = 1;
            mess.UserProfile.NotificationOffer = 1;
            mess.UserProfile.NotificationPayoff = 1;
            mess.UserProfile.NotificationPersonnelChange = 1;
            mess.UserProfile.NotificationReport = 1;
            mess.UserProfile.NotificationRewardDiscipline = 1;
            mess.UserProfile.NotificationSendCandidate = 1;
            mess.UserProfile.NotificationTag = 1;
            mess.UserProfile.NotificationTransferAsset = 1;
            mess.UserProfile.Password = obj.password;
            mess.UserProfile.Phone = obj.phone;
            mess.UserProfile.Status = obj.status;
            mess.UserProfile.StatusEmotion = Number(obj.statusEmotion);
            mess.UserProfile.Type365 = Number(obj.type365);
            mess.UserProfile.Type_Pass = Number(obj.type_Pass);
            mess.UserProfile.UserName = obj.userName;
            mess.UserProfile.isOnline = Number(obj.isOnline);
            mess.UserProfile.secretCode = obj.secretCode;
            mess.UserProfile.userQr = obj.userQr;
            mess.UserProfile.Looker = 0;
          }
          else {
            mess.UserProfile = {};
            mess.UserProfile.AcceptMessStranger = 0
            mess.UserProfile.Active = 0
            mess.UserProfile.AvatarUser = null;
            mess.UserProfile.CompanyId = 0
            mess.UserProfile.CompanyName = null;
            mess.UserProfile.Email = null;
            mess.UserProfile.FriendStatus = null;
            mess.UserProfile.FromWeb = null;
            mess.UserProfile.ID = 0
            mess.UserProfile.ID365 = 0
            mess.UserProfile.IDTimViec = 0
            mess.UserProfile.LastActive = `${JSON.parse(JSON.stringify(new Date(new Date().setHours(new Date().getHours() + 7)))).replace("Z", "")}+07:00`;
            mess.UserProfile.LinkAvatar = null;
            mess.UserProfile.Looker = 0
            mess.UserProfile.NotificationAcceptOffer = 0;
            mess.UserProfile.NotificationAllocationRecall = 0;
            mess.UserProfile.NotificationCalendar = 0;
            mess.UserProfile.NotificationChangeProfile = 0;
            mess.UserProfile.NotificationChangeSalary = 0;
            mess.UserProfile.NotificationCommentFromRaoNhanh = 0;
            mess.UserProfile.NotificationCommentFromTimViec = 0;
            mess.UserProfile.NotificationDecilineOffer = 0;
            mess.UserProfile.NotificationMissMessage = 0;
            mess.UserProfile.NotificationNTDApplying = 0;
            mess.UserProfile.NotificationNTDExpiredPin = 0;
            mess.UserProfile.NotificationNTDExpiredRecruit = 0;
            mess.UserProfile.NotificationNTDPoint = 0;
            mess.UserProfile.NotificationNewPersonnel = 0;
            mess.UserProfile.NotificationOffer = 0;
            mess.UserProfile.NotificationPayoff = 0;
            mess.UserProfile.NotificationPersonnelChange = 0;
            mess.UserProfile.NotificationReport = 0;
            mess.UserProfile.NotificationRewardDiscipline = 0;
            mess.UserProfile.NotificationSendCandidate = 0;
            mess.UserProfile.NotificationTag = 0;
            mess.UserProfile.NotificationTransferAsset = 0;
            mess.UserProfile.Password = null;
            mess.UserProfile.Phone = null;
            mess.UserProfile.Status = null;
            mess.UserProfile.StatusEmotion = 0;
            mess.UserProfile.Type365 = 0;
            mess.UserProfile.Type_Pass = 0;
            mess.UserProfile.UserName = null;
            mess.UserProfile.isOnline = 0;
            mess.UserProfile.secretCode = null;
            mess.UserProfile.userQr = null;
            mess.UserProfile.Looker = 0;
          }

          if (mess.DeleteType == 0 && mess.DeleteTime > 0) {
            mess.DeleteDate = (new Date()).setSeconds(new Date().getSeconds() + Number(deleteTime));
          }

          // lấy id kèm mảng trạng thái online 
          let listMember = [];
          let isOnline = [];
          Conversation.findOne({ _id: ConversationID }, { "memberList.memberId": 1, "memberList.liveChat": 1, "memberList.notification": 1, typeGroup: 1 })
            .then(async (conversation) => {

              // take data user 
              if (conversation && conversation.memberList) {
                for (let i = 0; i < conversation.memberList.length; i++) {
                  listMember.push(conversation.memberList[i].memberId);
                  isOnline.push(1);
                }
              }
              if (!listMember.find((e) => e == SenderID)) {
                return false
              }
              // live chat
              mess.liveChat = null;
              let typeSendLiveChat = "";
              if (liveChat) {
                mess.liveChat = null;
              }
              else if (conversation && conversation.memberList && (conversation.memberList.length > 0)) {
                let liveChatDB = conversation.memberList.find(e => e.memberId == SenderID);
                if (liveChatDB) {
                  liveChatDB = liveChatDB.liveChat;
                }
                if (liveChatDB && liveChatDB.clientId) {  // người gửi là client 
                  typeSendLiveChat = "ClientSend";
                  listMember = listMember.filter(e => e != SenderID); // id tài khoản tư vấn viên 
                  liveChatDB.clientName = liveChatDB.clientName ? liveChatDB.clientName : liveChatDB.clientId;
                  mess.liveChat = InfoLiveChat(liveChatDB.clientId, liveChatDB.clientName,
                    `${urlImgHost}avatar/${String(liveChatDB.clientName).trim()[0].toUpperCase()}_${getRandomInt(1, 4)}.png`,
                    liveChatDB.fromWeb
                  );
                }
                else {  // người gửi là tư vấn viên 
                  if (conversation.typeGroup == "liveChat") {
                    liveChatDB = conversation.memberList.find(e => e.memberId != SenderID);
                    liveChatDB = liveChatDB.liveChat;
                    if (liveChatDB) {
                      typeSendLiveChat = "HostSend";
                      listMember = listMember.filter(e => e == SenderID);// id tài khoản tư vấn viên 
                      liveChatDB.clientName = liveChatDB.clientName ? liveChatDB.clientName : liveChatDB.clientId;
                      mess.liveChat = InfoLiveChat(liveChatDB.clientId, liveChatDB.clientName,
                        `${urlImgHost}avatar/${String(liveChatDB.clientName.trim()[0]).toUpperCase()}_${getRandomInt(1, 4)}.png`,
                        liveChatDB.fromWeb
                      );
                    }
                  }
                }
              }

              // to main conversation group 
              let infoSupportDB = null; // tạo infor support để insert vào base 
              let LiveChatInfor = null;
              if (infoSupport && LiveChat) {
                let InfoSupport = ConvertToObject(infoSupport);
                let LiveChatObject = ConvertToObject(LiveChat);
                if (InfoSupport.Title == "Tin nhắn nhỡ") {
                  mess.InfoSupport = {};
                  mess.InfoSupport.HaveConversation = 0;
                  mess.InfoSupport.Message = req.body.MessageInforSupport;
                  mess.InfoSupport.Status = Number(InfoSupport.Status);
                  mess.InfoSupport.SupportId = mess.MessageID;
                  mess.InfoSupport.Time = "0001-01-01T00:00:00";
                  mess.InfoSupport.Title = InfoSupport.Title;
                  mess.InfoSupport.UserId = Number(InfoSupport.UserId) || 0;
                  mess.InfoSupport.userName = null;

                  infoSupportDB = InfoSupportDB(mess.InfoSupport.Title, mess.InfoSupport.Message,
                    mess.InfoSupport.SupportId, mess.InfoSupport.HaveConversation,
                    mess.InfoSupport.UserId, mess.InfoSupport.Status, String('0001-01-01T00:00:00.000+00:00')
                  );

                  mess.LiveChat = {};
                  mess.LiveChat.ClientAvatar = `${urlImgHost()}avatar/K_4.png`;
                  mess.LiveChat.ClientId = LiveChatObject.ClientId;
                  mess.LiveChat.ClientName = LiveChatObject.ClientName
                  mess.LiveChat.FromWeb = LiveChatObject.FromWeb;
                  mess.LiveChat.FromConversation = LiveChatObject.FromConversation;
                  LiveChatInfor = LiveChatDB(mess.LiveChat.ClientId, mess.LiveChat.ClientName, mess.LiveChat.FromWeb, mess.LiveChat.FromConversation)
                  socket.emit("SendMessage", mess, [mess.LiveChat.ClientId]); // gui lai chinh no 
                }
                // crm 
                else if (InfoSupport.Status && (Number(InfoSupport.Status) == 3)) {
                  mess.InfoSupport = {};
                  mess.InfoSupport.HaveConversation = 0;
                  mess.InfoSupport.Message = req.body.SmallTitile
                  mess.InfoSupport.Status = 0;
                  mess.InfoSupport.SupportId = mess.MessageID;
                  mess.InfoSupport.Time = "0001-01-01T00:00:00";
                  mess.InfoSupport.Title = InfoSupport.Title || "Hỗ trợ";
                  mess.InfoSupport.UserId = 0;
                  mess.InfoSupport.userName = null;

                  infoSupportDB = InfoSupportDB(mess.InfoSupport.Title, mess.InfoSupport.Message,
                    mess.InfoSupport.SupportId, mess.InfoSupport.HaveConversation,
                    mess.InfoSupport.UserId, mess.InfoSupport.Status || 0, String('0001-01-01T00:00:00.000+00:00')
                  );
                  mess.LiveChat = {};
                  mess.LiveChat.ClientAvatar = `${urlImgHost()}avatar/K_4.png`;
                  mess.LiveChat.ClientId = InfoSupport.ClientId;
                  mess.LiveChat.ClientName = InfoSupport.ClientName;
                  mess.LiveChat.FromWeb = InfoSupport.FromWeb;
                  mess.LiveChat.FromConversation = LiveChatObject.FromConversation || 0;
                  LiveChatInfor = LiveChatDB(mess.LiveChat.ClientId, mess.LiveChat.ClientName, mess.LiveChat.FromWeb, mess.LiveChat.FromConversation)
                  socket.emit("SendMessage", mess, [mess.LiveChat.ClientId]); // gui lai chinh no 
                }
                else {
                  mess.InfoSupport = {};
                  mess.InfoSupport.HaveConversation = 0;
                  mess.InfoSupport.Message = req.body.MessageInforSupport;
                  mess.InfoSupport.Status = 0;
                  mess.InfoSupport.SupportId = mess.MessageID;
                  mess.InfoSupport.Time = "0001-01-01T00:00:00";
                  mess.InfoSupport.Title = InfoSupport.Title || "Hỗ trợ";
                  mess.InfoSupport.UserId = 0;
                  mess.InfoSupport.userName = null;

                  infoSupportDB = InfoSupportDB(mess.InfoSupport.Title, mess.InfoSupport.Message,
                    mess.InfoSupport.SupportId, mess.InfoSupport.HaveConversation,
                    mess.InfoSupport.UserId, mess.InfoSupport.Status || 0, String('0001-01-01T00:00:00.000+00:00')
                  );

                  mess.LiveChat = {};
                  mess.LiveChat.ClientAvatar = `${urlImgHost()}avatar/K_4.png`;
                  mess.LiveChat.ClientId = LiveChatObject.ClientId;
                  mess.LiveChat.ClientName = LiveChatObject.ClientName
                  mess.LiveChat.FromWeb = LiveChatObject.FromWeb;
                  mess.LiveChat.FromConversation = LiveChatObject.FromConversation || 0;
                  LiveChatInfor = LiveChatDB(mess.LiveChat.ClientId, mess.LiveChat.ClientName, mess.LiveChat.FromWeb, mess.LiveChat.FromConversation)
                  socket.emit("SendMessage", mess, [mess.LiveChat.ClientId]); // gui lai chinh no 
                }

              };

              // to single conv live chat
              if (mess.liveChat != null) {
                // config cho giống live chat render 
                mess.EmotionMessage = null;
                mess.File = mess.ListFile;
                mess.InfoLink = null;
                mess.Profile = null;
                mess.InfoSupport = null;
                mess.IsClicked = 0;
                mess.IsEdited = 0;
                mess.Link = null;
                mess.LinkNotification = null;
                mess.Quote = mess.QuoteMessage;
                mess.SenderName = "Hỗ trợ khách hàng";
                mess.LiveChat = mess.liveChat;
                let listDevices = [];
                listDevices.push(mess.liveChat.ClientId);
                let currentWeb = mess.liveChat.FromWeb;
                if (typeSendLiveChat == "HostSend") {
                  mess.LiveChat = null;
                  mess.liveChat = null;
                }
                // sendNotificationToTimViec(mess, conversationName, mess.ConversationID, listMember, isOnline, isGroup, true);
                if (MessageType != "link") {
                  socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);

                  if (MessageType == "sendFile" || MessageType == "sendPhoto" || MessageType == "sendVoice") {
                    let findSend = [];
                    for (let i = 0; i < mess.ListFile.length; i++) {
                      findSend.push(FileSendDB((!isNaN(mess.ListFile[i].SizeFile)) ? Number(mess.ListFile[i].SizeFile) : 100, mess.ListFile[i].FullName ? String(mess.ListFile[i].FullName) : String(mess.ListFile[i].NameDisplay), Number(mess.ListFile[i].Height), Number(mess.ListFile[i].Width)))
                    };
                    Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                      if (counter && counter.length > 0 && counter[0].countID) {
                        const filter = { name: "MessageId" };
                        const update = { countID: counter[0].countID + 1 };
                        await Counter.updateOne(filter, update);
                        Conversation.updateOne({ _id: ConversationID }, { $set: { timeLastMessage: new Date(mess.CreateAt) } }).catch((e) => (console.log(e)));
                        if (typeSendLiveChat == "ClientSend") {
                          Conversation.updateOne({ _id: ConversationID }, {
                            $push: {
                              messageList: MessagesDB(
                                mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType,
                                mess.Message, mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0), findSend, EmotionMessageDBDefault(),
                                mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB,
                                LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                                [])
                            },
                            $set: { timeLastMessage: new Date(mess.CreateAt) }
                          }).catch(function (err) {
                            console.log(err);
                          });
                        }
                        else {
                          Conversation.updateOne({ _id: ConversationID }, {
                            $push: {
                              messageList: MessagesDB(
                                mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType,
                                mess.Message, mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0), findSend, EmotionMessageDBDefault(),
                                mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                            },
                            $set: { timeLastMessage: new Date(mess.CreateAt) }
                          }).catch(function (err) {
                            console.log(err);
                          });
                        }
                      }
                    }).catch(function (err) {
                      console.log(err);
                    });
                  }
                  else if (MessageType == "map") {
                    let z = mess.Message.split(",");
                    let link = `https://www.google.com/maps/search/${z[0].trim()},${z[1].trim()}/${z[0].trim()},${z[1].trim()},10z?hl=vi`;
                    mess.InfoLink = {};
                    mess.InfoLink.HaveImage = "False";
                    let index = link.indexOf("/", 9);
                    if (index != -1) {
                      mess.InfoLink.LinkHome = link.slice(0, index);
                    }
                    else {
                      mess.InfoLink.LinkHome = link;
                    }
                    axios.get(link).then((doc) => {
                      if (doc && doc.data) {
                        mess.InfoLink.Title = String(doc.data).split("<title>")[1].split("</title>")[0].trim() || "Không tìm thấy thông tin website";
                        mess.InfoLink.Description = null;
                        let Image = String(doc.data).split(`property="og:image`)[0].replace(`"`, '');
                        mess.InfoLink.Image = Image.split(`<meta content=`)[Image.split(`<meta content=`).length - 1].replace('"', ``).replace('"', ``);
                        mess.InfoLink.Image = String(mess.InfoLink.Image).replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').trim();
                        if (mess.InfoLink.Image) {
                          mess.InfoLink.HaveImage = "True";
                        }
                        mess.InfoLink.MessageID = null;
                        mess.InfoLink.TypeLink = null;

                        // gửi lại link bằng socket 
                        socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);
                        // thêm dữ liệu vào base
                        Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                          if (counter && counter.length > 0 && counter[0].countID) {
                            const filter = { name: "MessageId" };
                            const update = { countID: counter[0].countID + 1 };
                            await Counter.updateOne(filter, update);
                            if (typeSendLiveChat == "ClientSend") {
                              Conversation.updateOne({ _id: ConversationID }, {
                                $push: {
                                  messageList: MessagesDB(
                                    mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                    mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                    infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                    mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB,
                                    LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                                    [])
                                },
                                $set: { timeLastMessage: new Date(mess.CreateAt) }
                              }).catch(function (err) {
                                console.log(err);
                              });
                            }
                            else {
                              Conversation.updateOne({ _id: ConversationID }, {
                                $push: {
                                  messageList: MessagesDB(
                                    mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                    mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                    infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                    mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                                },
                                $set: { timeLastMessage: new Date(mess.CreateAt) }
                              }).catch(function (err) {
                                console.log(err);
                              });
                            }
                          }
                        }).catch(function (err) {
                          console.log(err);
                        });
                      }
                    }).catch((e) => {
                      console.log(e)
                    })
                  }
                  else {

                    Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                      if (counter && counter.length > 0 && counter[0].countID) {
                        const filter = { name: "MessageId" };
                        const update = { countID: counter[0].countID + 1 };
                        await Counter.updateOne(filter, update);
                        if (typeSendLiveChat == "ClientSend") {
                          Conversation.updateOne({ _id: ConversationID }, {
                            $push: {
                              messageList: MessagesDB(
                                mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                                mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0),
                                mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB,
                                LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                                [])
                            },
                            $set: { timeLastMessage: new Date(mess.CreateAt) }
                          }).catch(function (err) {
                            myConsole.log("Loi sendMessage_V2");
                            myConsole.log(req.body);
                            myConsole.log("Add datamessage failed");
                            myConsole.log(err);
                            console.log(err);
                          });
                        }
                        else {
                          Conversation.updateOne({ _id: ConversationID }, {
                            $push: {
                              messageList: MessagesDB(
                                mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                                mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0),
                                mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                            },
                            $set: { timeLastMessage: new Date(mess.CreateAt) }
                          }).catch(function (err) {
                            console.log(err);
                          });
                        }
                      }
                    }).catch(function (err) {
                      myConsole.log("Loi sendMessage_V2");
                      myConsole.log(req.body);
                      myConsole.log("error take counter");
                      myConsole.log(err);
                      console.log(err);
                    });
                  }
                }

                if ((MessageType == "link") || (MessageType == "text")) {
                  if (MessageType == "link") { // gửi socket 2 lần, lưu vào base 1 tin nhắn 
                    socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);
                    mess.InfoLink = {};
                    mess.InfoLink.HaveImage = "False";
                    if (String(mess.Message)[String(mess.Message).length - 1] == "/") {
                      mess.Message = String(mess.Message).slice(0, String(mess.Message).length - 1)
                    };
                    mess.InfoLink.LinkHome = mess.Message;

                    let doc = await getLinkPreview(
                      `${mess.Message}`
                    );
                    if (doc) {
                      mess.InfoLink.Title = doc.title || "Không tìm thấy thông tin website";
                      mess.InfoLink.Description = doc.description || null;
                      mess.InfoLink.Image = (doc.images.length > 0) ? doc.images[0] : null;
                      if (mess.InfoLink.Image) {
                        mess.InfoLink.HaveImage = "True";
                      }
                      mess.InfoLink.MessageID = null;
                      mess.InfoLink.TypeLink = null;
                      mess.InfoLink.IsNotification = 0;
                    }
                    else {
                      mess.InfoLink.Title = "Không tìm thấy thông tin website";
                      mess.InfoLink.Description = null;
                      mess.InfoLink.Image = null;
                      mess.InfoLink.MessageID = null;
                      mess.InfoLink.TypeLink = null;
                      mess.InfoLink.IsNotification = 0;
                    }
                    socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);
                    Conversation.updateOne({ _id: ConversationID }, { $set: { timeLastMessage: new Date(mess.CreateAt) } }).catch((e) => (console.log(e)));
                    // insert link to base 
                    Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                      if (counter && counter.length > 0 && counter[0].countID) {
                        const filter = { name: "MessageId" };
                        const update = { countID: counter[0].countID + 1 };
                        await Counter.updateOne(filter, update);
                        if (typeSendLiveChat == "ClientSend") {
                          Conversation.updateOne({ _id: ConversationID }, {
                            $push: {
                              messageList: MessagesDB(
                                mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                                mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB,
                                LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                                [])
                            },
                            $set: { timeLastMessage: new Date(mess.CreateAt) }
                          }).catch(function (err) {
                            console.log(err);
                          });
                        }
                        else {
                          Conversation.updateOne({ _id: ConversationID }, {
                            $push: {
                              messageList: MessagesDB(
                                mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                                mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                            },
                            $set: { timeLastMessage: new Date(mess.CreateAt) }
                          }).catch(function (err) {
                            console.log(err);
                          });
                        }
                      }
                    }).catch(function (err) {
                      console.log(err);
                    });
                    MarkUnreaderMessage(ConversationID, SenderID, listMember);
                  }
                  else { // text chứa link; bắn 2 lần socket và lưu 2 tin nhắn 
                    mess.InfoLink = {};
                    mess.InfoLink.HaveImage = "False";
                    let urlCheck = new RegExp("[a-zA-Z\d]+://(\w+:\w+@)?([a-zA-Z\d.-]+\.[A-Za-z]{2,4})(:\d+)?(/.*)?")
                    if (urlCheck.test(mess.Message)) {
                      let link = mess.Message.slice(mess.Message.indexOf('http'), mess.Message.length);
                      getLinkPreview(
                        `${link}`
                      ).then((doc) => {
                        if (doc) {

                          mess.InfoLink.LinkHome = doc.url;
                          mess.InfoLink.Title = doc.title || "Không tìm thấy thông tin website";
                          mess.InfoLink.Description = doc.description || null;
                          mess.InfoLink.Image = (doc.images.length > 0) ? doc.images[0] : null;
                          if (mess.InfoLink.Image) {
                            mess.InfoLink.HaveImage = "True";
                          }
                          mess.InfoLink.MessageID = null;
                          mess.InfoLink.TypeLink = null;
                          mess.InfoLink.IsNotification = 0;
                          // bắn trc 1 socket cho bên app render 
                          mess.Message = doc.url;
                          mess.MessageType = "link";
                          mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000000 + 8}_${SenderID}`;
                          socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);
                          Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                            if (counter && counter.length > 0 && counter[0].countID) {
                              const filter = { name: "MessageId" };
                              const update = { countID: counter[0].countID + 1 };
                              await Counter.updateOne(filter, update);
                              if (typeSendLiveChat == "ClientSend") {
                                Conversation.updateOne({ _id: ConversationID }, {
                                  $push: {
                                    messageList: MessagesDB(
                                      mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                      mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                      infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                      mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate,
                                      infoSupportDB,
                                      LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                                      [])
                                  },
                                  $set: { timeLastMessage: new Date(mess.CreateAt) }
                                }).catch(function (err) {
                                  console.log(err);
                                });
                              } else {
                                Conversation.updateOne({ _id: ConversationID }, {
                                  $push: {
                                    messageList: MessagesDB(
                                      mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                      mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                      infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                      mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                                  },
                                  $set: { timeLastMessage: new Date(mess.CreateAt) }
                                }).catch(function (err) {
                                  console.log(err);
                                });
                              }
                            }
                          }).catch(function (err) {
                            console.log(err);
                          });
                          MarkUnreaderMessage(ConversationID, SenderID, listMember);
                        }
                      }).catch((e) => {
                        mess.InfoLink.Title = "Không tìm thấy thông tin website";
                        mess.InfoLink.Description = null;
                        mess.InfoLink.Image = null;
                        mess.InfoLink.MessageID = null;
                        mess.InfoLink.TypeLink = null;
                        mess.InfoLink.LinkHome = link.trim();
                        mess.InfoLink.IsNotification = 0;
                        // bắn trc 1 socket cho bên app render
                        mess.Message = link.trim();
                        mess.MessageType = "link";
                        mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000000 + 8}_${SenderID}`;
                        socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);
                        Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                          if (counter && counter.length > 0 && counter[0].countID) {
                            const filter = { name: "MessageId" };
                            const update = { countID: counter[0].countID + 1 };
                            await Counter.updateOne(filter, update);
                            if (typeSendLiveChat == "ClientSend") {
                              Conversation.updateOne({ _id: ConversationID }, {
                                $push: {
                                  messageList: MessagesDB(
                                    mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                    mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                    infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                    mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB,
                                    LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                                    [])
                                },
                                $set: { timeLastMessage: new Date(mess.CreateAt) }
                              }).catch(function (err) {
                                console.log(err);
                              });
                            }
                            else {
                              Conversation.updateOne({ _id: ConversationID }, {
                                $push: {
                                  messageList: MessagesDB(
                                    mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                    mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                    infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                    mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                                },
                                $set: { timeLastMessage: new Date(mess.CreateAt) }
                              }).catch(function (err) {
                                console.log(err);
                              });
                            }
                          }
                        }).catch(function (err) {
                          console.log(err);
                        });
                        MarkUnreaderMessage(ConversationID, SenderID, listMember);
                      });
                    }
                  }
                }
                // đánh dấu tin nhắn chưa đọc 
                MarkUnreaderMessage(ConversationID, SenderID, listMember);
              }
              else {

                sendNotificationToTimViec(mess, conversationName, mess.ConversationID, listMember, isOnline, isGroup, true);
                if (MessageType != "link") {

                  if (req.body.from && (req.body.from == "Chat Winform")) {
                    if (MessageType == "sendFile" || MessageType == "sendPhoto") {
                      console.log("k ban socket vi api upload file da co")
                    }
                    else {
                      socket.emit("SendMessage", mess, listMember);
                    }
                  }
                  else {
                    socket.emit("SendMessage", mess, listMember);
                  }

                  if (MessageType == "sendFile" || MessageType == "sendPhoto" || MessageType == "sendVoice") {
                    let findSend = [];
                    for (let i = 0; i < mess.ListFile.length; i++) {
                      findSend.push(FileSendDB((!isNaN(mess.ListFile[i].SizeFile)) ? Number(mess.ListFile[i].SizeFile) : 100, mess.ListFile[i].FullName ? String(mess.ListFile[i].FullName) : String(mess.ListFile[i].NameDisplay), Number(mess.ListFile[i].Height), Number(mess.ListFile[i].Width)))
                    };
                    Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                      if (counter && counter.length > 0 && counter[0].countID) {
                        const filter = { name: "MessageId" };
                        const update = { countID: counter[0].countID + 1 };
                        await Counter.updateOne(filter, update);
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType,
                              mess.Message, mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0), findSend, EmotionMessageDBDefault(),
                              mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [])
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                        });
                      }
                    }).catch(function (err) {
                      console.log(err);
                    });
                  }
                  else if (MessageType == "map") {
                    let z = mess.Message.split(",");
                    let link = `https://www.google.com/maps/search/${z[0].trim()},${z[1].trim()}/${z[0].trim()},${z[1].trim()},10z?hl=vi`;
                    mess.InfoLink = {};
                    mess.InfoLink.HaveImage = "False";
                    let index = link.indexOf("/", 9);
                    if (index != -1) {
                      mess.InfoLink.LinkHome = link.slice(0, index);
                    }
                    else {
                      mess.InfoLink.LinkHome = link;
                    }
                    axios.get(link).then((doc) => {
                      if (doc && doc.data) {
                        mess.InfoLink.Title = String(doc.data).split("<title>")[1].split("</title>")[0].trim() || "Không tìm thấy thông tin website";
                        mess.InfoLink.Description = null;
                        let Image = String(doc.data).split(`property="og:image`)[0].replace(`"`, '');
                        mess.InfoLink.Image = Image.split(`<meta content=`)[Image.split(`<meta content=`).length - 1].replace('"', ``).replace('"', ``);
                        mess.InfoLink.Image = String(mess.InfoLink.Image).replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').trim();
                        if (mess.InfoLink.Image) {
                          mess.InfoLink.HaveImage = "True";
                        }
                        mess.InfoLink.MessageID = null;
                        mess.InfoLink.TypeLink = null;
                        socket.emit("SendMessage", mess, listMember);
                        // thêm dữ liệu vào base
                        Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                          if (counter && counter.length > 0 && counter[0].countID) {
                            const filter = { name: "MessageId" };
                            const update = { countID: counter[0].countID + 1 };
                            await Counter.updateOne(filter, update);
                            Conversation.updateOne({ _id: ConversationID }, {
                              $push: {
                                messageList: MessagesDB(
                                  mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                  mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                  infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                  mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [])
                              },
                              $set: { timeLastMessage: new Date(mess.CreateAt) }
                            }).catch(function (err) {
                              console.log(err);
                            });
                          }
                        }).catch(function (err) {
                          console.log(err);
                        });
                      }
                    }).catch((e) => {
                      console.log(e)
                    })
                  }
                  else {
                    Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                      if (counter && counter.length > 0 && counter[0].countID) {
                        const filter = { name: "MessageId" };
                        const update = { countID: counter[0].countID + 1 };
                        await Counter.updateOne(filter, update);

                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, Message,
                              mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0),
                              mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [])
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          myConsole.log("Loi sendMessage_V2");
                          myConsole.log(req.body);
                          myConsole.log("Add datamessage failed");
                          myConsole.log(err);
                          console.log(err);
                        });

                      }
                    }).catch(function (err) {
                      myConsole.log("Loi sendMessage_V2");
                      myConsole.log(req.body);
                      myConsole.log("error take counter");
                      myConsole.log(err);
                      console.log(err);
                    });
                  }
                }

                if ((MessageType == "link") || (MessageType == "text")) {
                  if (MessageType == "link") { // gửi socket 2 lần, lưu vào base 1 tin nhắn 
                    socket.emit("SendMessage", mess, listMember);
                    mess.InfoLink = {};
                    mess.InfoLink.HaveImage = "False";
                    if (String(mess.Message)[String(mess.Message).length - 1] == "/") {
                      mess.Message = String(mess.Message).slice(0, String(mess.Message).length - 1)
                    };
                    mess.InfoLink.LinkHome = mess.Message;

                    let doc = await getLinkPreview(
                      `${mess.Message}`
                    );
                    if (doc) {
                      mess.InfoLink.Title = doc.title || "Không tìm thấy thông tin website";
                      mess.InfoLink.Description = doc.description || null;
                      mess.InfoLink.Image = (doc.images && (doc.images.length > 0)) ? doc.images[0] : null;
                      if (mess.InfoLink.Image) {
                        mess.InfoLink.HaveImage = "True";
                      }
                      mess.InfoLink.MessageID = null;
                      mess.InfoLink.TypeLink = null;
                      mess.InfoLink.IsNotification = 0;
                    }
                    else {
                      mess.InfoLink.Title = "Không tìm thấy thông tin website";
                      mess.InfoLink.Description = null;
                      mess.InfoLink.Image = null;
                      mess.InfoLink.MessageID = null;
                      mess.InfoLink.TypeLink = null;
                      mess.InfoLink.IsNotification = 0;
                    }
                    socket.emit("SendMessage", mess, listMember);
                    // insert link to base 
                    Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                      if (counter && counter.length > 0 && counter[0].countID) {
                        const filter = { name: "MessageId" };
                        const update = { countID: counter[0].countID + 1 };
                        await Counter.updateOne(filter, update);

                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                              mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                              infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                              mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [])
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                        });
                      }
                    }).catch(function (err) {
                      console.log(err);
                    });
                    MarkUnreaderMessage(ConversationID, SenderID, listMember);
                  }
                  else { // text chứa link; bắn 2 lần socket và lưu 2 tin nhắn 
                    mess.InfoLink = {};
                    mess.InfoLink.HaveImage = "False";
                    let urlCheck = new RegExp("[a-zA-Z\d]+://(\w+:\w+@)?([a-zA-Z\d.-]+\.[A-Za-z]{2,4})(:\d+)?(/.*)?")
                    if (urlCheck.test(mess.Message)) {
                      let link = mess.Message.slice(mess.Message.indexOf('http'), mess.Message.length);
                      getLinkPreview(
                        `${link}`
                      ).then((doc) => {
                        if (doc) {
                          mess.InfoLink.LinkHome = doc.url;
                          mess.InfoLink.Title = doc.title || "Không tìm thấy thông tin website";
                          mess.InfoLink.Description = doc.description || null;
                          mess.InfoLink.Image = (doc.images.length > 0) ? doc.images[0] : null;
                          if (mess.InfoLink.Image) {
                            mess.InfoLink.HaveImage = "True";
                          }
                          mess.InfoLink.MessageID = null;
                          mess.InfoLink.TypeLink = null;
                          mess.InfoLink.IsNotification = 0;
                          // bắn trc 1 socket cho bên app render 
                          mess.Message = doc.url;
                          mess.MessageType = "link";
                          mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000001 + 8}_${SenderID}`;
                          socket.emit("SendMessage", mess, listMember);
                          Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                            if (counter && counter.length > 0 && counter[0].countID) {
                              const filter = { name: "MessageId" };
                              const update = { countID: counter[0].countID + 1 };
                              await Counter.updateOne(filter, update);

                              Conversation.updateOne({ _id: ConversationID }, {
                                $push: {
                                  messageList: MessagesDB(
                                    mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                    mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                    infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                    mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [])
                                },
                                $set: { timeLastMessage: new Date(mess.CreateAt) }
                              }).catch(function (err) {
                                console.log(err);
                              });
                            }
                          }).catch(function (err) {
                            console.log(err);
                          });
                          MarkUnreaderMessage(ConversationID, SenderID, listMember);
                        }
                      }).catch((e) => {
                        mess.InfoLink.Title = "Không tìm thấy thông tin website";
                        mess.InfoLink.Description = null;
                        mess.InfoLink.Image = null;
                        mess.InfoLink.MessageID = null;
                        mess.InfoLink.TypeLink = null;
                        mess.InfoLink.LinkHome = link.trim();
                        mess.InfoLink.IsNotification = 0;
                        // bắn trc 1 socket cho bên app render
                        mess.Message = link.trim();
                        mess.MessageType = "link";
                        mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000000 + 8}_${SenderID}`;
                        socket.emit("SendMessage", mess, listMember);
                        Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                          if (counter && counter.length > 0 && counter[0].countID) {
                            const filter = { name: "MessageId" };
                            const update = { countID: counter[0].countID + 1 };
                            await Counter.updateOne(filter, update);

                            Conversation.updateOne({ _id: ConversationID }, {
                              $push: {
                                messageList: MessagesDB(
                                  mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                  mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                  infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                  mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [])
                              },
                              $set: { timeLastMessage: new Date(mess.CreateAt) }
                            }).catch(function (err) {
                              console.log(err);
                            });
                          }
                        }).catch(function (err) {
                          console.log(err);
                        });
                        MarkUnreaderMessage(ConversationID, SenderID, listMember);
                      });
                    }
                  }
                }
                // đánh dấu tin nhắn chưa đọc 
                MarkUnreaderMessage(ConversationID, SenderID, listMember);
              }

              let listUserOffline = [];
              User.find({ _id: { $in: listMember } }, { isOnline: 1, userName: 1 }).then(async (listUser) => {
                if (listUser && listUser.length) {
                  let listOnline2 = await axios.get('http://43.239.223.142:3000/takelistuseronline');
                  listOnline2 = listOnline2.data.listOnline;
                  for (let i = 0; i < listMember.length; i++) {
                    let a = listUser.find((e) => e._id == listMember[i]);
                    if (a) {
                      if (Number(a._id) !== SenderID) {
                        if (conversation.memberList.find((e) => e.memberId == listMember[i])) {
                          if (conversation.memberList.find((e) => e.memberId == listMember[i]).notification != 0) {
                            if ((a.isOnline) == 0 && Number(a._id) !== SenderID) {
                              listUserOffline.push(listMember[i]);
                            }
                            else if (!listOnline2.find((e) => e == listMember[i])) {
                              listUserOffline.push(listMember[i]);
                            }
                          }
                        }
                      }
                    }
                  };
                  // for (let i = 0; i < listMember.length; i++) {
                  //   let a = listUser.find((e) => e._id == listMember[i]);
                  //   if (a) {
                  //     if (a.isOnline == 0) {
                  //       listUserOffline.push(listMember[i]);
                  //     }
                  //   }
                  // };
                  if (listUserOffline.length) {
                    if (req.body.MessageType == "text") {
                      axios({
                        method: "post",
                        url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                        data: {
                          IdReceiver: JSON.stringify(listUserOffline),
                          conversationId: ConversationID,
                          sendername: listUser.find((e) => e._id == mess.SenderID) ? listUser.find((e) => e._id == mess.SenderID).userName : "",
                          ava: 'a',
                          mess: mess.Message,
                          type: 'text',
                          idSender: mess.SenderID,
                          mask: 1
                        },
                        headers: { "Content-Type": "multipart/form-data" }
                      }).catch((e) => {
                        console.log(e)
                      })
                    }
                    else if (req.body.MessageType == "map") {
                      axios({
                        method: "post",
                        url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                        data: {
                          IdReceiver: JSON.stringify(listUserOffline),
                          conversationId: ConversationID,
                          sendername: listUser.find((e) => e._id == mess.SenderID) ? listUser.find((e) => e._id == mess.SenderID).userName : "",
                          ava: 'a',
                          mess: 'Bạn đã nhận được 1 vị trí ',
                          type: 'text',
                          idSender: mess.SenderID,
                          mask: 1
                        },
                        headers: { "Content-Type": "multipart/form-data" }
                      }).catch((e) => {
                        console.log(e)
                      })
                    }
                    else if (req.body.MessageType == "sendProfile") {
                      axios({
                        method: "post",
                        url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                        data: {
                          IdReceiver: JSON.stringify(listUserOffline),
                          conversationId: ConversationID,
                          sendername: listUser.find((e) => e._id == mess.SenderID) ? listUser.find((e) => e._id == mess.SenderID).userName : "",
                          ava: 'a',
                          mess: 'Bạn đã nhận được 1 thẻ liên hệ',
                          type: 'text',
                          idSender: mess.SenderID,
                          mask: 1
                        },
                        headers: { "Content-Type": "multipart/form-data" }
                      }).catch((e) => {
                        console.log(e)
                      })
                    }
                    else {
                      axios({
                        method: "post",
                        url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                        data: {
                          IdReceiver: JSON.stringify(listUserOffline),
                          conversationId: ConversationID,
                          sendername: listUser.find((e) => e._id == mess.SenderID) ? listUser.find((e) => e._id == mess.SenderID).userName : "",
                          ava: 'a',
                          mess: 'Bạn đã nhận được 1 file',
                          type: 'text',
                          idSender: mess.SenderID,
                          mask: 1
                        },
                        headers: { "Content-Type": "multipart/form-data" }
                      }).catch((e) => {
                        console.log(e)
                      })
                    }
                  }
                }
              }).catch((e) => { console.log(e) })
            }).catch(function (err) {
              console.log(err);
            });

        }
        else {
          return res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
        }
      }
      else {
        myConsole.log("Loi sendMessage_V2");
        myConsole.log(req.body);
        myConsole.log("Supporter is not online now, setInterval in 8s, during this time, if supporter is not online, this message will be redirected to origin Group (FromConversation)");
        res.status(200).json(createError(200, "Supporter is not online now, setInterval in 8s, during this time, if supporter is not online, this message will be redirected to origin Group (FromConversation)"));
      }
    }
    else {
      myConsole.log("Loi sendMessage_V2");
      myConsole.log(req.body);
      myConsole.log("Thông tin truyền lên không đầy đủ");
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  }
  catch (e) {
    myConsole.log("Loi sendMessage_V2");
    myConsole.log(req.body);
    myConsole.log(e);
    console.log("Loi sendMessage_V2", e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}


const takeIdFromId365 = async (Id365) => {
  try {
    let user = await User.findOne({ id365: Id365 }, { _id: 1 });
    if (user) {
      return user._id
    }
  }
  catch (e) {
    console.log(e);
    return 0;
  }
}
// for timviec
export const SendMessage_v3 = async (req, res) => {
  try {
    // console.log(req.body)
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.SenderID)) {
        console.log("Token hop le, SendMessage_v3")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body && req.body.SenderID && (!isNaN(req.body.SenderID))) {
      let listOnline = [];

      let ConversationID = 0;
      let SenderID = Number(req.body.SenderID);
      //SenderID = await takeIdFromId365(SenderID);
      let ContactId = await takeIdFromId365(Number(req.body.ContactId));
      let createConversation = await axios({
        method: "post",
        url: "http://43.239.223.142:9000/api/conversations/CreateNewConversation",
        data: {
          'userId': SenderID,
          'contactId': ContactId
        },
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (createConversation && createConversation.data && createConversation.data.data && createConversation.data.data.conversationId) {
        ConversationID = Number(createConversation.data.data.conversationId);
      }
      else {
        return res.status(200).json(createError(200, "Can not create Conversation"));
      }
      let Message = req.body.Message ? String(req.body.Message) : "";
      let Quote = req.body.Quote ? String(req.body.Quote) : "";
      let Profile = req.body.Profile ? String(req.body.Profile) : "";
      let ListTag = req.body.ListTag ? String(req.body.ListTag) : "";
      let File = req.body.File ? String(req.body.File) : "";
      let ListMember = req.body.ListMember ? JSON.parse(req.body.ListMember) : [];
      let IsOnline = req.body.IsOnline ? String(req.body.IsOnline) : "";
      let conversationName = req.body.conversationName ? String(req.body.conversationName) : "";
      let isGroup = (req.body.isGroup && (!isNaN(req.body.isGroup))) ? Number(req.body.isGroup) : 0;
      let deleteTime = (req.body.deleteTime && (!isNaN(req.body.deleteTime))) ? Number(req.body.deleteTime) : 0;
      let deleteType = (req.body.deleteType && (!isNaN(req.body.deleteType))) ? Number(req.body.deleteType) : 0;
      let liveChat = req.body.liveChat ? String(req.body.liveChat) : null;
      let infoSupport = req.body.InfoSupport ? String(req.body.InfoSupport) : null;
      let timeLivechat = req.body.TimeLiveChat ? req.body.TimeLiveChat : null;
      let uscid = req.body.uscid ? req.body.uscid : ''
      let isSecret = req.body.isSecret ? Number(req.body.isSecret) : 0

      // add friend ntd with uv. 
      if (req.body.ContactId) {
        AddFriend(Number(req.body.SenderID), Number(req.body.ContactId));
      }
      if (req.body.MessageType && (req.body.File || req.body.Message || req.body.Quote)) {
        // let finduser = User.findOne({_id:SenderId})
        let MessageType = String(req.body.MessageType);
        let mess = {};
        mess.MessageID = "";
        if (req.body.MessageID && (req.body.MessageID.trim() != "")) {
          mess.MessageID = req.body.MessageID;
        }
        else {
          mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000000 + 8}_${SenderID}`;
        }
        mess.CreateAt = `${JSON.parse(JSON.stringify(new Date(new Date().setHours(new Date().getHours() + 7)))).replace("Z", "")}+07:00`;
        res.json({
          data: {
            countMessage: 0,
            listMessages: null,
            message: "Gửi thành công",
            messageId: mess.MessageID,
            createAt: mess.CreateAt,
            message_info: null,
            result: true,
            senderName: "Hỗ trợ khách hàng"
          },
          error: null
        })
        mess.ConversationID = ConversationID;
        mess.SenderID = SenderID;
        mess.MessageType = MessageType;
        mess.Message = Message;
        mess.ListTag = ListTag;
        mess.DeleteTime = deleteTime;
        mess.DeleteType = deleteType;
        mess.DeleteDate = String('0001-01-01T00:00:00.000+00:00');
        mess.IsFavorite = 0;
        mess.uscid = uscid
        mess.isSecret = isSecret
        mess.linkNotification = req.body.link || req.body.Link || req.body.linkNotification || null

        if (isGroup == 0) {
          const receivedId = ListMember.find(member => member !== SenderID)
          const companyIdReceive = req.body.companyIdReceive ? Number(req.body.companyIdReceive) : 0
          const [listConvStrange, lastConvStrange] = await FGetListConversationIdStrange(receivedId, companyIdReceive)
          console.log('test', listConvStrange, lastConvStrange)
          mess.strange = [
            {
              userId: receivedId,
              status: 1
            },
            {
              userId: SenderID,
              status: listConvStrange.includes(ConversationID) ? 0 : 1
            }
          ]
        }

        if (!req.body.Quote || (String(req.body.Quote).trim() == "") || (String(req.body.Quote) == "null")) {
          mess.QuoteMessage = MessageQuote("", "", 0, "", "", `${JSON.parse(JSON.stringify(new Date())).replace("Z", "")}6769+07:00`);
        }
        else {
          mess.QuoteMessage = ConvertToObjectQuote(req.body.Quote);
          mess.QuoteMessage.SenderID = Number(mess.QuoteMessage.SenderID);
        }

        if (req.body.File && (String(req.body.File) != "null")) {
          mess.ListFile = JSON.parse(req.body.File);
          for (let i = 0; i < mess.ListFile.length; i++) {
            if (mess.ListFile[i].FullName && (mess.ListFile[i].FullName.trim() != "")) {
              mess.ListFile[i].NameDownload = mess.ListFile[i].FullName.replace(/[ +!@#$%^&*]/g, '');
              // mess.ListFile[i].FullName = mess.ListFile[i].FullName.replace(/[ +!@#$%^&*]/g, '');
            }
            else {
              mess.ListFile[i].NameDownload = "";
              mess.ListFile[i].FullName = "";
            }
            if ((!isNaN(mess.ListFile[i].Height))) {
              mess.ListFile[i].Height = Number(mess.ListFile[i].Height);
            }
            else {
              mess.ListFile[i].Height = 10;
            }

            if ((!isNaN(mess.ListFile[i].Width))) {
              mess.ListFile[i].Width = Number(mess.ListFile[i].Width);
            }
            else {
              mess.ListFile[i].Width = 10;
            };
            if (mess.ListFile[i].Width == 0 && mess.ListFile[i].TypeFile == 'sendPhoto') {
              const metadata = await sharp(`C:/Chat365/publish/wwwroot/uploads/${mess.ListFile[i].NameDownload}`).metadata();
              mess.ListFile[i].Height = metadata.height;
              mess.ListFile[i].Width = metadata.width;
            }
            if ((!isNaN(mess.ListFile[i].SizeFile))) {
              mess.ListFile[i].SizeFile = Number(mess.ListFile[i].SizeFile);
            }
            else {
              mess.ListFile[i].SizeFile = 10;
            };
            if (mess.ListFile[i].FullName == 'null') {
              mess.ListFile[i].FullName = mess.ListFile[i].NameDisplay;
            };
            // console.log("Obj file sau khi sua:0",mess.ListFile[i])
          };
          // console.log(mess.ListFile)
        }
        else {
          mess.ListFile = null;
        }

        if (MessageType == "sendCv" && req.body.File && (String(req.body.File) != "null")) {
          mess.Message = mess.ListFile[0].FullName
          for (let i = 0; i < mess.ListFile.length; i++) {
            if (mess.ListFile[i].FullName.split(".")[mess.ListFile[i].FullName.split(".").length - 1] == "pdf") {
              mess.linkPdf = `https://ht.timviec365.vn:9002/uploads/${mess.ListFile[i].FullName}`
            }
            else if (mess.ListFile[i].FullName.split(".")[mess.ListFile[i].FullName.split(".").length - 1] == "png") {
              mess.linkPng = `https://ht.timviec365.vn:9002/uploads/${mess.ListFile[i].FullName}`
            }
          }
        }
        if (req.body.Profile && (String(req.body.Profile) != "null")) {
          let obj = ConvertToObject(req.body.Profile);
          mess.Message = obj.id;
          mess.UserProfile = {};
          mess.UserProfile.AcceptMessStranger = Number(obj.acceptMessStranger)
          mess.UserProfile.Active = Number(obj.active)
          mess.UserProfile.AvatarUser = obj.avatarUser;
          mess.UserProfile.CompanyId = Number(obj.companyId)
          mess.UserProfile.CompanyName = obj.companyName;
          mess.UserProfile.Email = obj.email;
          mess.UserProfile.FriendStatus = obj.friendStatus;
          mess.UserProfile.FromWeb = obj.fromWeb;
          mess.UserProfile.ID = Number(obj.id)
          mess.UserProfile.ID365 = (!isNaN(obj.iD365)) ? Number(obj.iD365) : 0;
          mess.UserProfile.IDTimViec = Number(obj.idTimViec)
          mess.UserProfile.LastActive = `${JSON.parse(JSON.stringify(new Date(new Date().setHours(new Date().getHours() + 7)))).replace("Z", "")}+07:00`;
          mess.UserProfile.LinkAvatar = obj.avatarUser;
          mess.UserProfile.Looker = Number(obj.looklooker)
          mess.UserProfile.NotificationAcceptOffer = 1;
          mess.UserProfile.NotificationAllocationRecall = 1;
          mess.UserProfile.NotificationCalendar = 1;
          mess.UserProfile.NotificationChangeProfile = 1;
          mess.UserProfile.NotificationChangeSalary = 1;
          mess.UserProfile.NotificationCommentFromRaoNhanh = 1;
          mess.UserProfile.NotificationCommentFromTimViec = 1;
          mess.UserProfile.NotificationDecilineOffer = 1;
          mess.UserProfile.NotificationMissMessage = 1;
          mess.UserProfile.NotificationNTDApplying = 0;
          mess.UserProfile.NotificationNTDExpiredPin = 1;
          mess.UserProfile.NotificationNTDExpiredRecruit = 1;
          mess.UserProfile.NotificationNTDPoint = 1;
          mess.UserProfile.NotificationNewPersonnel = 1;
          mess.UserProfile.NotificationOffer = 1;
          mess.UserProfile.NotificationPayoff = 1;
          mess.UserProfile.NotificationPersonnelChange = 1;
          mess.UserProfile.NotificationReport = 1;
          mess.UserProfile.NotificationRewardDiscipline = 1;
          mess.UserProfile.NotificationSendCandidate = 1;
          mess.UserProfile.NotificationTag = 1;
          mess.UserProfile.NotificationTransferAsset = 1;
          mess.UserProfile.Password = obj.password;
          mess.UserProfile.Phone = obj.phone;
          mess.UserProfile.Status = obj.status;
          mess.UserProfile.StatusEmotion = Number(obj.statusEmotion);
          mess.UserProfile.Type365 = Number(obj.type365);
          mess.UserProfile.Type_Pass = Number(obj.type_Pass);
          mess.UserProfile.UserName = obj.userName;
          mess.UserProfile.isOnline = Number(obj.isOnline);
          mess.UserProfile.secretCode = obj.secretCode;
          mess.UserProfile.userQr = obj.userQr;
          mess.UserProfile.Looker = 0;
        }
        else {
          mess.UserProfile = {};
          mess.UserProfile.AcceptMessStranger = 0
          mess.UserProfile.Active = 0
          mess.UserProfile.AvatarUser = null;
          mess.UserProfile.CompanyId = 0
          mess.UserProfile.CompanyName = null;
          mess.UserProfile.Email = null;
          mess.UserProfile.FriendStatus = null;
          mess.UserProfile.FromWeb = null;
          mess.UserProfile.ID = 0
          mess.UserProfile.ID365 = 0
          mess.UserProfile.IDTimViec = 0
          mess.UserProfile.LastActive = `${JSON.parse(JSON.stringify(new Date(new Date().setHours(new Date().getHours() + 7)))).replace("Z", "")}+07:00`;
          mess.UserProfile.LinkAvatar = null;
          mess.UserProfile.Looker = 0
          mess.UserProfile.NotificationAcceptOffer = 0;
          mess.UserProfile.NotificationAllocationRecall = 0;
          mess.UserProfile.NotificationCalendar = 0;
          mess.UserProfile.NotificationChangeProfile = 0;
          mess.UserProfile.NotificationChangeSalary = 0;
          mess.UserProfile.NotificationCommentFromRaoNhanh = 0;
          mess.UserProfile.NotificationCommentFromTimViec = 0;
          mess.UserProfile.NotificationDecilineOffer = 0;
          mess.UserProfile.NotificationMissMessage = 0;
          mess.UserProfile.NotificationNTDApplying = 0;
          mess.UserProfile.NotificationNTDExpiredPin = 0;
          mess.UserProfile.NotificationNTDExpiredRecruit = 0;
          mess.UserProfile.NotificationNTDPoint = 0;
          mess.UserProfile.NotificationNewPersonnel = 0;
          mess.UserProfile.NotificationOffer = 0;
          mess.UserProfile.NotificationPayoff = 1;
          mess.UserProfile.NotificationPersonnelChange = 0;
          mess.UserProfile.NotificationReport = 0;
          mess.UserProfile.NotificationRewardDiscipline = 0;
          mess.UserProfile.NotificationSendCandidate = 0;
          mess.UserProfile.NotificationTag = 0;
          mess.UserProfile.NotificationTransferAsset = 0;
          mess.UserProfile.Password = null;
          mess.UserProfile.Phone = null;
          mess.UserProfile.Status = null;
          mess.UserProfile.StatusEmotion = 0;
          mess.UserProfile.Type365 = 0;
          mess.UserProfile.Type_Pass = 0;
          mess.UserProfile.UserName = null;
          mess.UserProfile.isOnline = 0;
          mess.UserProfile.secretCode = null;
          mess.UserProfile.userQr = null;
        }

        // sendProfile if have sdt 
        if (String(req.body.messageType == "text") && checkPhoneNumberInMessage(Message) != null) {
          let obj = {}
          let finduser = await User.findOne({ email: checkPhoneNumberInMessage(Message) }).lean()
          if (finduser) {
            obj.Message = finduser.id;
            obj = {};
            obj.acceptMessStranger = Number(finduser.acceptMessStranger)
            obj.active = Number(finduser.active)
            obj.avatarUser = finduser.avatarUser;
            obj.companyId = Number(finduser.companyId)
            obj.companyName = finduser.companyName;
            obj.email = finduser.email;
            obj.friendStatus = 0
            obj.fromWeb = finduser.fromWeb;
            obj.id = Number(finduser._id)
            obj.iD365 = (!isNaN(finduser.id365)) ? Number(finduser.id365) : 0;
            obj.idTimViec = Number(finduser.idTimViec)
            obj.LastActive = `${JSON.parse(JSON.stringify(new Date(new Date().setHours(new Date().getHours() + 7)))).replace("Z", "")}+07:00`;
            obj.avatarUser = finduser.avatarUser;
            obj.Looker = 0
            obj.NotificationAcceptOffer = 1;
            obj.NotificationAllocationRecall = 1;
            obj.NotificationCalendar = 1;
            obj.NotificationChangeProfile = 1;
            obj.NotificationChangeSalary = 1;
            obj.NotificationCommentFromRaoNhanh = 1;
            obj.NotificationCommentFromTimViec = 1;
            obj.NotificationDecilineOffer = 1;
            obj.NotificationMissMessage = 1;
            obj.NotificationNTDApplying = 0;
            obj.NotificationNTDExpiredPin = 1;
            obj.NotificationNTDExpiredRecruit = 1;
            obj.NotificationNTDPoint = 1;
            obj.NotificationNewPersonnel = 1;
            obj.NotificationOffer = 1;
            obj.NotificationPayoff = 1;
            obj.NotificationPersonnelChange = 1;
            obj.NotificationReport = 1;
            obj.NotificationRewardDiscipline = 1;
            obj.NotificationSendCandidate = 1;
            obj.NotificationTag = 1;
            obj.NotificationTransferAsset = 1;
            obj.password = finduser.password;
            obj.phone = finduser.phone;
            obj.status = finduser.status;
            obj.statusEmotion = 0
            obj.type365 = Number(finduser.type365);
            obj.type_Pass = 0
            obj.userName = finduser.userName;
            obj.isOnline = Number(finduser.isOnline);
            obj.secretCode = finduser.secretCode;
            obj.userQr = finduser.userQr;
            FSendMessage({
              body: {
                ConversationID: ConversationID,
                SenderID: SenderID,
                MessageType: "sendProfile",
                Message: finduser._id,
                Profile: obj,
                ListMember: JSON.stringify(ListMember),
                companyIdReceive: req.body.companyIdReceive ? req.body.companyIdReceive : 0
              }
            }).catch((e) => {
              console.log("error when send profile internal message", e)
            })
          }
        }

        if (mess.DeleteType == 0 && mess.DeleteTime > 0) {
          // mess.DeleteDate = (new Date()).setSeconds(new Date().getSeconds() + Number(deleteTime));
          const time = new Date()
          time.setSeconds(time.getSeconds() + Number(deleteTime))
          time.setHours(time.getHours() + 7)
          mess.DeleteDate = time
        }


        let listMember = [];
        let isOnline = [];

        let conversation = await Conversation.findOne({ _id: ConversationID }, { adminId: 1, "memberList.memberId": 1, "memberList.conversationName": 1, "memberList.liveChat": 1, "memberList.notification": 1, "memberList.deleteTime": 1, typeGroup: 1, isGroup: 1, IdCustomer: 1 }).lean();
        if (conversation) {
          conversationName = conversation.memberList.find((e) => e.memberId == SenderID).conversationName;
          if (conversation && conversation.memberList) {
            for (let i = 0; i < conversation.memberList.length; i++) {
              listMember.push(conversation.memberList[i].memberId);
              isOnline.push(1);
            }
          }
          if (!listMember.find((e) => e == SenderID)) {
            return false
          }

          if (conversation.typeGroup == "liveChatV2") {
            let clientObj = conversation.memberList.find((e) => e.liveChat != null);
            if (clientObj) {
              let clientId = clientObj.memberId;
              let fromConv = clientObj.liveChat.fromConversation;
              let LiveChat = clientObj.liveChat;
              if (clientId && fromConv && LiveChat) {
                let object;
                if (req.body.MessageInforSupport) {
                  object = ConvertToObject(req.body.MessageInforSupport);
                }
                else {
                  object = {
                    userName: '',
                    phone: '',
                    email: '',
                    site: ''
                  }
                }
                let MessageInforSupport = `Họ tên: ${object.userName}, SĐT: ${object.phone}, Email: ${object.email}, website: ${object.site}`;
                if (listConvTestLiveChatV2.includes(Number(ConversationID))) {
                  socket.emit("SendMessageLiveChatV2", mess, listMember, SenderID, clientId, ConversationID, fromConv, LiveChat, MessageInforSupport, object);
                }

              }
            }
          }
          // live chat
          mess.liveChat = null;
          let typeSendLiveChat = "";
          if (liveChat) {
            mess.liveChat = null;
          }
          else if (conversation && conversation.memberList && (conversation.memberList.length > 0)) {
            let liveChatDB = conversation.memberList.find(e => e.memberId == SenderID);
            if (liveChatDB) {
              liveChatDB = liveChatDB.liveChat;
            }
            if (liveChatDB && liveChatDB.clientId) {  // người gửi là client 
              typeSendLiveChat = "ClientSend";
              listMember = listMember.filter(e => e != SenderID); // id tài khoản tư vấn viên 
              liveChatDB.clientName = liveChatDB.clientName ? liveChatDB.clientName : liveChatDB.clientId;
              mess.liveChat = InfoLiveChat(liveChatDB.clientId, liveChatDB.clientName,
                `${urlImgHost}avatar/${String(liveChatDB.clientName).trim()[0].toUpperCase()}_${getRandomInt(1, 4)}.png`,
                liveChatDB.fromWeb
              );
            }
            else {  // người gửi là tư vấn viên 
              if (conversation.typeGroup == "liveChat") {
                liveChatDB = conversation.memberList.find(e => e.memberId != SenderID);
                liveChatDB = liveChatDB.liveChat;
                if (liveChatDB) {
                  typeSendLiveChat = "HostSend";
                  listMember = listMember.filter(e => e == SenderID);// id tài khoản tư vấn viên 
                  liveChatDB.clientName = liveChatDB.clientName ? liveChatDB.clientName : liveChatDB.clientId;
                  mess.liveChat = InfoLiveChat(liveChatDB.clientId, liveChatDB.clientName,
                    `${urlImgHost}avatar/${String(liveChatDB.clientName.trim()[0]).toUpperCase()}_${getRandomInt(1, 4)}.png`,
                    liveChatDB.fromWeb
                  );
                }
              }
            }
          }

          // to main conversation group 
          let infoSupportDB = null; // tạo infor support để insert vào base 
          let LiveChatInfor = null;
          if (infoSupport) {
            let InfoSupport = ConvertToObject(infoSupport);

            if (InfoSupport.Title == "Tin nhắn nhỡ") {
              mess.InfoSupport = {};
              mess.InfoSupport.HaveConversation = 0;
              mess.InfoSupport.Message = `${InfoSupport.Message}${infoSupport.split(",")[2]}${infoSupport.split(",")[3]}${infoSupport.split(",")[4].replace('"', '').replace('}', '')}`;
              mess.InfoSupport.Status = Number(InfoSupport.Status);
              mess.InfoSupport.SupportId = mess.MessageID;
              mess.InfoSupport.Time = "0001-01-01T00:00:00";
              mess.InfoSupport.Title = InfoSupport.Title;
              mess.InfoSupport.UserId = Number(InfoSupport.UserId);
              mess.InfoSupport.userName = null;

              infoSupportDB = InfoSupportDB(mess.InfoSupport.Title, mess.InfoSupport.Message,
                mess.InfoSupport.SupportId, mess.InfoSupport.HaveConversation,
                mess.InfoSupport.UserId, mess.InfoSupport.Status, String('0001-01-01T00:00:00.000+00:00')
              );

              mess.LiveChat = {};
              mess.LiveChat.ClientAvatar = `${urlImgHost()}avatar/K_4.png`;
              mess.LiveChat.ClientId = infoSupport.split(",")[2].split(":")[1].trim();
              mess.LiveChat.ClientName = `Khách hàng ${mess.InfoSupport.Message.split(":")[2].split(",")[0].replace('tôi cần bạn hỗ trợ!', '').trim()}`
              mess.LiveChat.FromWeb = mess.InfoSupport.Message.split(":")[2].split(",")[0].replace('tôi cần bạn hỗ trợ!', '').trim().split(".")[0];
              LiveChatInfor = LiveChatDB(mess.LiveChat.ClientId, mess.LiveChat.ClientName, mess.LiveChat.FromWeb)
              socket.emit("SendMessage", mess, [mess.LiveChat.ClientId]); // gui lai chinh no 
              // socket.emit("TimeLiveChat", timeLivechat, [mess.LiveChat.ClientId]); 
            }
            // crm 
            else if (InfoSupport.Status && (Number(InfoSupport.Status) == 3)) {
              mess.InfoSupport = {};
              mess.InfoSupport.HaveConversation = 0;
              mess.InfoSupport.Message = req.body.SmallTitile
              mess.InfoSupport.Status = 0;
              mess.InfoSupport.SupportId = mess.MessageID;
              mess.InfoSupport.Time = "0001-01-01T00:00:00";
              mess.InfoSupport.Title = InfoSupport.Title || "Hỗ trợ";
              mess.InfoSupport.UserId = 0;
              mess.InfoSupport.userName = null;

              infoSupportDB = InfoSupportDB(mess.InfoSupport.Title, mess.InfoSupport.Message,
                mess.InfoSupport.SupportId, mess.InfoSupport.HaveConversation,
                mess.InfoSupport.UserId, mess.InfoSupport.Status || 0, String('0001-01-01T00:00:00.000+00:00')
              );
              mess.LiveChat = {};
              mess.LiveChat.ClientAvatar = `${urlImgHost()}avatar/K_4.png`;
              mess.LiveChat.ClientId = InfoSupport.ClientId;
              mess.LiveChat.ClientName = InfoSupport.ClientName;
              mess.LiveChat.FromWeb = InfoSupport.FromWeb;
              LiveChatInfor = LiveChatDB(mess.LiveChat.ClientId, mess.LiveChat.ClientName, mess.LiveChat.FromWeb)
              socket.emit("SendMessage", mess, [mess.LiveChat.ClientId]); // gui lai chinh no 
              // socket.emit("TimeLiveChat", timeLivechat, [mess.LiveChat.ClientId]); 
            }
            else {
              mess.InfoSupport = {};
              mess.InfoSupport.HaveConversation = 0;
              if (infoSupport.split(",")[4]) {
                mess.InfoSupport.Message = `${InfoSupport.Message}${infoSupport.split(",")[2]}${infoSupport.split(",")[3]}${infoSupport.split(",")[4].replace('"', '').replace('}', '')}`;
              }
              else {
                mess.InfoSupport.Message = `${InfoSupport.Message}${infoSupport.split(",")[2]}${infoSupport.split(",")[3]}`
              }
              mess.InfoSupport.Status = 0;
              mess.InfoSupport.SupportId = mess.MessageID;
              mess.InfoSupport.Time = "0001-01-01T00:00:00";
              mess.InfoSupport.Title = InfoSupport.Title || "Hỗ trợ";
              mess.InfoSupport.UserId = 0;
              mess.InfoSupport.userName = null;

              infoSupportDB = InfoSupportDB(mess.InfoSupport.Title, mess.InfoSupport.Message,
                mess.InfoSupport.SupportId, mess.InfoSupport.HaveConversation,
                mess.InfoSupport.UserId, mess.InfoSupport.Status || 0, String('0001-01-01T00:00:00.000+00:00')
              );

              mess.LiveChat = {};
              mess.LiveChat.ClientAvatar = `${urlImgHost()}avatar/K_4.png`;
              mess.LiveChat.ClientId = infoSupport.split(",")[2].split(":")[1].trim();
              mess.LiveChat.ClientName = `Khách hàng ${mess.InfoSupport.Message.split(":")[2].split(",")[0].replace('tôi cần bạn hỗ trợ!', '').trim()}`
              mess.LiveChat.FromWeb = mess.InfoSupport.Message.split(":")[2].split(",")[0].replace('tôi cần bạn hỗ trợ!', '').trim().split(".")[0];
              LiveChatInfor = LiveChatDB(mess.LiveChat.ClientId, mess.LiveChat.ClientName, mess.LiveChat.FromWeb)
              socket.emit("SendMessage", mess, [mess.LiveChat.ClientId]); // gui lai chinh no 
            }

          };

          // to single conv live chat
          if (mess.liveChat != null) {
            // config cho giống live chat render 
            mess.EmotionMessage = null;
            mess.File = mess.ListFile;
            mess.InfoLink = null;
            mess.Profile = null;
            mess.InfoSupport = null;
            mess.IsClicked = 0;
            mess.IsEdited = 0;
            mess.Link = null;
            mess.LinkNotification = null;
            mess.Quote = mess.QuoteMessage;
            mess.SenderName = "Hỗ trợ khách hàng";
            mess.LiveChat = mess.liveChat;
            let listDevices = [];
            listDevices.push(mess.liveChat.ClientId);
            let currentWeb = mess.liveChat.FromWeb;
            if (typeSendLiveChat == "HostSend") {
              mess.LiveChat = null;
              mess.liveChat = null;
            }
            // sendNotificationToTimViec(mess, conversationName, mess.ConversationID, listMember, isOnline, isGroup, true);
            if (MessageType != "link") {
              socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);

              if (MessageType == "sendFile" || MessageType == "sendPhoto" || MessageType == "sendVoice") {
                let findSend = [];
                for (let i = 0; i < mess.ListFile.length; i++) {
                  findSend.push(FileSendDB((!isNaN(mess.ListFile[i].SizeFile)) ? Number(mess.ListFile[i].SizeFile) : 100, mess.ListFile[i].FullName ? String(mess.ListFile[i].FullName) : String(mess.ListFile[i].NameDisplay), Number(mess.ListFile[i].Height), Number(mess.ListFile[i].Width)))
                };
                Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                  if (counter && counter.length > 0 && counter[0].countID) {
                    const filter = { name: "MessageId" };
                    const update = { countID: counter[0].countID + 1 };
                    await Counter.updateOne(filter, update);
                    Conversation.updateOne({ _id: ConversationID }, { $set: { timeLastMessage: new Date(mess.CreateAt) } }).catch((e) => (console.log(e)));
                    if (typeSendLiveChat == "ClientSend") {
                      Conversation.updateOne({ _id: ConversationID }, {
                        $push: {
                          messageList: MessagesDB(
                            mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType,
                            mess.Message, mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0), findSend, EmotionMessageDBDefault(),
                            mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB,
                            LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                            [])
                        },
                        $set: { timeLastMessage: new Date(mess.CreateAt) }
                      }).catch(function (err) {
                        console.log(err);
                        return false;
                      });
                    }
                    else {
                      Conversation.updateOne({ _id: ConversationID }, {
                        $push: {
                          messageList: MessagesDB(
                            mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType,
                            mess.Message, mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0), findSend, EmotionMessageDBDefault(),
                            mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                        },
                        $set: { timeLastMessage: new Date(mess.CreateAt) }
                      }).catch(function (err) {
                        console.log(err);
                      });
                    }
                    return true;
                  }
                }).catch(function (err) {
                  console.log(err);
                  return false;
                });
              }
              else if (MessageType == "map") {
                let z = mess.Message.split(",");
                let link = `https://www.google.com/maps/search/${z[0].trim()},${z[1].trim()}/${z[0].trim()},${z[1].trim()},10z?hl=vi`;
                mess.InfoLink = {};
                mess.InfoLink.HaveImage = "False";
                let index = link.indexOf("/", 9);
                if (index != -1) {
                  mess.InfoLink.LinkHome = link.slice(0, index);
                }
                else {
                  mess.InfoLink.LinkHome = link;
                }
                axios.get(link).then((doc) => {
                  if (doc && doc.data) {
                    mess.InfoLink.Title = String(doc.data).split("<title>")[1].split("</title>")[0].trim() || "Không tìm thấy thông tin website";
                    mess.InfoLink.Description = null;
                    let Image = String(doc.data).split(`property="og:image`)[0].replace(`"`, '');
                    mess.InfoLink.Image = Image.split(`<meta content=`)[Image.split(`<meta content=`).length - 1].replace('"', ``).replace('"', ``);
                    mess.InfoLink.Image = String(mess.InfoLink.Image).replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').trim();
                    if (mess.InfoLink.Image) {
                      mess.InfoLink.HaveImage = "True";
                    }
                    mess.InfoLink.MessageID = null;
                    mess.InfoLink.TypeLink = null;

                    // gửi lại link bằng socket 
                    socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);
                    // thêm dữ liệu vào base
                    Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                      if (counter && counter.length > 0 && counter[0].countID) {
                        const filter = { name: "MessageId" };
                        const update = { countID: counter[0].countID + 1 };
                        await Counter.updateOne(filter, update);
                        if (typeSendLiveChat == "ClientSend") {
                          Conversation.updateOne({ _id: ConversationID }, {
                            $push: {
                              messageList: MessagesDB(
                                mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB,
                                LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                                [])
                            },
                            $set: { timeLastMessage: new Date(mess.CreateAt) }
                          }).catch(function (err) {
                            console.log(err);
                            return false;
                          });
                        }
                        else {
                          Conversation.updateOne({ _id: ConversationID }, {
                            $push: {
                              messageList: MessagesDB(
                                mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                            },
                            $set: { timeLastMessage: new Date(mess.CreateAt) }
                          }).catch(function (err) {
                            console.log(err);
                            return false;
                          });
                        }
                      }
                      return true;
                    }).catch(function (err) {
                      console.log(err);
                    });
                  }
                }).catch((e) => {
                  console.log(e)
                })
              }
              else {

                Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                  if (counter && counter.length > 0 && counter[0].countID) {
                    const filter = { name: "MessageId" };
                    const update = { countID: counter[0].countID + 1 };
                    await Counter.updateOne(filter, update);
                    if (typeSendLiveChat == "ClientSend") {
                      Conversation.updateOne({ _id: ConversationID }, {
                        $push: {
                          messageList: MessagesDB(
                            mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                            mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0),
                            mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB,
                            LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                            [])
                        },
                        $set: { timeLastMessage: new Date(mess.CreateAt) }
                      }).catch(function (err) {
                        console.log(err);
                      });
                    }
                    else {
                      Conversation.updateOne({ _id: ConversationID }, {
                        $push: {
                          messageList: MessagesDB(
                            mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                            mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0),
                            mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                        },
                        $set: { timeLastMessage: new Date(mess.CreateAt) }
                      }).catch(function (err) {
                        console.log(err);
                      });
                    }
                  }
                  return true;
                }).catch(function (err) {
                  console.log(err);
                  return false;
                });
              }
            }

            if ((MessageType == "link") || (MessageType == "text")) {
              if (MessageType == "link") { // gửi socket 2 lần, lưu vào base 1 tin nhắn 
                socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);
                mess.InfoLink = {};
                mess.InfoLink.HaveImage = "False";
                if (String(mess.Message)[String(mess.Message).length - 1] == "/") {
                  mess.Message = String(mess.Message).slice(0, String(mess.Message).length - 1)
                };
                mess.InfoLink.LinkHome = mess.Message;

                let doc = await getLinkPreview(
                  `${mess.Message}`
                );
                if (doc) {
                  mess.InfoLink.Title = doc.title;
                  mess.InfoLink.Description = doc.description || null;
                  mess.InfoLink.Image = (doc.images.length > 0) ? doc.images[0] : null;
                  if (mess.InfoLink.Image) {
                    mess.InfoLink.HaveImage = "True";
                  }
                  mess.InfoLink.MessageID = null;
                  mess.InfoLink.TypeLink = null;
                  mess.InfoLink.IsNotification = 0;
                  socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);
                  Conversation.updateOne({ _id: ConversationID }, { $set: { timeLastMessage: new Date(mess.CreateAt) } }).catch((e) => (console.log(e)));
                  // insert link to base 
                  Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                    if (counter && counter.length > 0 && counter[0].countID) {
                      const filter = { name: "MessageId" };
                      const update = { countID: counter[0].countID + 1 };
                      await Counter.updateOne(filter, update);
                      if (typeSendLiveChat == "ClientSend") {
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                              mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                              infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                              mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB,
                              LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                              [])
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                          return false;
                        });
                      }
                      else {
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                              mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                              infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                              mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                          return false;
                        });
                      }
                    };
                    return true;
                  }).catch(function (err) {
                    console.log(err);
                  });
                  MarkUnreaderMessage(ConversationID, SenderID, listMember);
                }
              }
              else { // text chứa link; bắn 2 lần socket và lưu 2 tin nhắn 
                mess.InfoLink = {};
                mess.InfoLink.HaveImage = "False";
                let urlCheck = new RegExp("[a-zA-Z\d]+://(\w+:\w+@)?([a-zA-Z\d.-]+\.[A-Za-z]{2,4})(:\d+)?(/.*)?")
                if (urlCheck.test(mess.Message)) {
                  let link = mess.Message.slice(mess.Message.indexOf('http'), mess.Message.length);
                  getLinkPreview(
                    `${link}`
                  ).then((doc) => {
                    if (doc) {

                      mess.InfoLink.LinkHome = doc.url;
                      mess.InfoLink.Title = doc.title || "Không tìm thấy thông tin website";
                      mess.InfoLink.Description = doc.description || null;
                      mess.InfoLink.Image = (doc.images.length > 0) ? doc.images[0] : null;
                      if (mess.InfoLink.Image) {
                        mess.InfoLink.HaveImage = "True";
                      }
                      mess.InfoLink.MessageID = null;
                      mess.InfoLink.TypeLink = null;
                      mess.InfoLink.IsNotification = 0;
                      // bắn trc 1 socket cho bên app render 
                      mess.Message = doc.url;
                      mess.MessageType = "link";
                      mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000000 + 8}_${SenderID}`;
                      socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);
                      Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                        if (counter && counter.length > 0 && counter[0].countID) {
                          const filter = { name: "MessageId" };
                          const update = { countID: counter[0].countID + 1 };
                          await Counter.updateOne(filter, update);
                          if (typeSendLiveChat == "ClientSend") {
                            Conversation.updateOne({ _id: ConversationID }, {
                              $push: {
                                messageList: MessagesDB(
                                  mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                  mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                  infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                  mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate,
                                  infoSupportDB,
                                  LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                                  [])
                              },
                              $set: { timeLastMessage: new Date(mess.CreateAt) }
                            }).catch(function (err) {
                              console.log(err);
                              return false;
                            });
                          } else {
                            Conversation.updateOne({ _id: ConversationID }, {
                              $push: {
                                messageList: MessagesDB(
                                  mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                  mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                  infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                  mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                              },
                              $set: { timeLastMessage: new Date(mess.CreateAt) }
                            }).catch(function (err) {
                              console.log(err);
                              return false;
                            });
                          }
                        };
                        return true;
                      }).catch(function (err) {
                        console.log(err);
                      });
                      MarkUnreaderMessage(ConversationID, SenderID, listMember);
                    }
                  }).catch((e) => {
                    console.log('Khong lay anh xem trc')
                  });
                }
              }
            }
            MarkUnreaderMessage(ConversationID, SenderID, listMember);
          }
          else {
            // console.log("send message normaly")
            sendNotificationToTimViec(mess, conversationName, mess.ConversationID, listMember, isOnline, isGroup, true);
            if (MessageType != "link") {
              if (!mess.Message) {
                mess.Message = req.body.Message;
              };
              if (req.body.from && (req.body.from == "Chat Winform")) {
                if (MessageType == "sendFile" || MessageType == "sendPhoto") {
                  console.log("k ban socket vi api upload file da co")
                }
                else {
                  if (MessageType == "OfferReceive" || MessageType == "applying") {
                    mess.link = req.body.Link;
                  };
                  socket.emit("SendMessage", mess, listMember);
                  SendMessageMqtt(listMember, mess);
                }
              }
              else {
                if (MessageType == "OfferReceive" || MessageType == "applying") {
                  mess.link = req.body.Link;
                }
                socket.emit("SendMessage", mess, listMember);
                SendMessageMqtt(listMember, mess);
              }

              if (MessageType == "sendFile" || MessageType == "sendPhoto" || MessageType == "sendVoice" || MessageType == "sendCv") {
                // console.log('Send Mess File:', req.body.File)
                let findSend = [];
                for (let i = 0; i < mess.ListFile.length; i++) {
                  findSend.push(FileSendDB((!isNaN(mess.ListFile[i].SizeFile)) ? Number(mess.ListFile[i].SizeFile) : 100, mess.ListFile[i].FullName ? String(mess.ListFile[i].FullName) : String(mess.ListFile[i].NameDisplay), Number(mess.ListFile[i].Height), Number(mess.ListFile[i].Width)))
                };
                Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                  if (counter && counter.length > 0 && counter[0].countID) {
                    const filter = { name: "MessageId" };
                    const update = { countID: counter[0].countID + 1 };
                    await Counter.updateOne(filter, update);
                    Conversation.updateOne({ _id: ConversationID }, {
                      $push: {
                        messageList: MessagesDB(
                          mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType,
                          mess.ListFile[0].FullName, mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0), findSend, EmotionMessageDBDefault(),
                          mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [], null, uscid, isSecret)
                      },
                      $set: { timeLastMessage: new Date(mess.CreateAt) }
                    }).catch(function (err) {
                      console.log(err);
                      return false;
                    });
                    return true;
                  }
                }).catch(function (err) {
                  console.log(err);
                  return false;
                });
              }
              else if (MessageType == "map") {
                let z = mess.Message.split(",");
                let link = `https://www.google.com/maps/search/${z[0].trim()},${z[1].trim()}/${z[0].trim()},${z[1].trim()},10z?hl=vi`;
                mess.InfoLink = {};
                mess.InfoLink.HaveImage = "False";
                let index = link.indexOf("/", 9);
                if (index != -1) {
                  mess.InfoLink.LinkHome = link.slice(0, index);
                }
                else {
                  mess.InfoLink.LinkHome = link;
                }
                axios.get(link).then((doc) => {
                  if (doc && doc.data) {
                    mess.InfoLink.Title = String(doc.data).split("<title>")[1].split("</title>")[0].trim();
                    mess.InfoLink.Description = null;
                    let Image = String(doc.data).split(`property="og:image`)[0].replace(`"`, '');
                    mess.InfoLink.Image = Image.split(`<meta content=`)[Image.split(`<meta content=`).length - 1].replace('"', ``).replace('"', ``);
                    mess.InfoLink.Image = String(mess.InfoLink.Image).replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').trim();
                    if (mess.InfoLink.Image) {
                      mess.InfoLink.HaveImage = "True";
                    }
                    mess.InfoLink.MessageID = null;
                    mess.InfoLink.TypeLink = null;
                    socket.emit("SendMessage", mess, listMember);
                    // thêm dữ liệu vào base
                    Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                      if (counter && counter.length > 0 && counter[0].countID) {
                        const filter = { name: "MessageId" };
                        const update = { countID: counter[0].countID + 1 };
                        await Counter.updateOne(filter, update);
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                              mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                              infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                              mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [], null, uscid, isSecret)
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                          return false;
                        });
                      }
                    }).catch(function (err) {
                      console.log(err);
                      return false;
                    });
                  }
                }).catch((e) => {
                  console.log(e);
                  return false;
                })
              }
              else if (MessageType == "OfferReceive" || MessageType == "applying") {
                Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                  if (counter && counter.length > 0 && counter[0].countID) {
                    const filter = { name: "MessageId" };
                    const update = { countID: counter[0].countID + 1 };
                    await Counter.updateOne(filter, update);
                    Conversation.updateOne({ _id: ConversationID }, {
                      $push: {
                        messageList: MessagesDB(
                          mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, Message,
                          mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, req.body.Link, null, 0),
                          mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [], null, uscid, isSecret)
                      },
                      $set: { timeLastMessage: new Date(mess.CreateAt) }
                    }).catch(function (err) {
                      console.log(err);
                      return false;
                    });
                    return true;
                  }
                }).catch(function (err) {
                  console.log(err);
                  return false;
                });
              }
              else {
                Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                  if (counter && counter.length > 0 && counter[0].countID) {
                    const filter = { name: "MessageId" };
                    const update = { countID: counter[0].countID + 1 };
                    await Counter.updateOne(filter, update);
                    Conversation.updateOne({ _id: ConversationID }, {
                      $push: {
                        messageList: MessagesDB(
                          mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, Message,
                          mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0),
                          mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [], null, uscid, isSecret)
                      },
                      $set: { timeLastMessage: new Date(mess.CreateAt) }
                    }).catch(function (err) {
                      console.log(err);
                      return false;
                    });
                    return true;
                  }
                }).catch(function (err) {
                  console.log(err);
                  return false;
                });
              }
            }
            if ((MessageType == "link") || (MessageType == "text")) {
              if (MessageType == "link") { // gửi socket 2 lần, lưu vào base 1 tin nhắn 
                socket.emit("SendMessage", mess, listMember);
                mess.InfoLink = {};
                mess.InfoLink.HaveImage = "False";
                if (String(mess.Message)[String(mess.Message).length - 1] == "/") {
                  mess.Message = String(mess.Message).slice(0, String(mess.Message).length - 1)
                };
                mess.InfoLink.LinkHome = mess.Message;

                getLinkPreview(
                  `${mess.Message}`
                ).then((doc) => {
                  if (doc) {
                    mess.InfoLink.Title = doc.title || "Không tìm thấy thông tin website";
                    mess.InfoLink.Description = doc.description || null;
                    mess.InfoLink.Image = (doc.images && (doc.images.length > 0)) ? doc.images[0] : null;
                    if (mess.InfoLink.Image) {
                      mess.InfoLink.HaveImage = "True";
                    }
                    mess.InfoLink.MessageID = null;
                    mess.InfoLink.TypeLink = null;
                    mess.InfoLink.IsNotification = 0;
                    socket.emit("SendMessage", mess, listMember);
                    // insert link to base 
                    Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                      if (counter && counter.length > 0 && counter[0].countID) {
                        const filter = { name: "MessageId" };
                        const update = { countID: counter[0].countID + 1 };
                        await Counter.updateOne(filter, update);
                        console.log("Data message Insert Link", infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0))
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                              mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                              infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                              mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [],)
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                          return false;
                        });
                        return true;
                      }
                    }).catch(function (err) {
                      console.log(err);
                      return false;
                    });
                    MarkUnreaderMessage(ConversationID, SenderID, listMember);
                  }
                }).catch((e) => {
                  console.log('Khong lay anh xem truoc')
                })

              }
              else { // text chứa link; bắn 2 lần socket và lưu 2 tin nhắn 
                mess.InfoLink = {};
                mess.InfoLink.HaveImage = "False";
                if (!TestTwoLink(mess.Message)) {
                  let urlCheck = new RegExp("[a-zA-Z\d]+://(\w+:\w+@)?([a-zA-Z\d.-]+\.[A-Za-z]{2,4})(:\d+)?(/.*)?");
                  if (urlCheck.test(mess.Message)) {
                    let link = mess.Message.slice(mess.Message.indexOf('http'), mess.Message.length);
                    getLinkPreview(
                      `${link}`
                    ).then((doc) => {
                      if (doc) {
                        mess.InfoLink.LinkHome = doc.url;
                        mess.InfoLink.Title = doc.title;
                        mess.InfoLink.Description = doc.description || null;
                        mess.InfoLink.Image = (doc.images.length > 0) ? doc.images[0] : null;
                        if (mess.InfoLink.Image) {
                          mess.InfoLink.HaveImage = "True";
                        }
                        mess.InfoLink.MessageID = null;
                        mess.InfoLink.TypeLink = null;
                        mess.InfoLink.IsNotification = 0;
                        // bắn trc 1 socket cho bên app render 
                        mess.Message = doc.url;
                        mess.MessageType = "link";
                        mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000001 + 8}_${SenderID}`;
                        socket.emit("SendMessage", mess, listMember);
                        Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                          if (counter && counter.length > 0 && counter[0].countID) {
                            const filter = { name: "MessageId" };
                            const update = { countID: counter[0].countID + 1 };
                            await Counter.updateOne(filter, update);

                            Conversation.updateOne({ _id: ConversationID }, {
                              $push: {
                                messageList: MessagesDB(
                                  mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                  mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                  infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                  mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [], null, uscid, isSecret)
                              },
                              $set: { timeLastMessage: new Date(mess.CreateAt) }
                            }).catch(function (err) {
                              console.log(err);
                            });
                            return true;
                          }
                        }).catch(function (err) {
                          console.log(err);
                          return false;
                        });
                        MarkUnreaderMessage(ConversationID, SenderID, listMember);
                      }
                    }).catch((e) => {
                      console.log('Khong lay anh xem truocw')
                      return true
                    });
                  }
                }
              }
            }
            MarkUnreaderMessage(ConversationID, SenderID, listMember);
          }

          let listUserOffline = [];
          User.find({ _id: { $in: listMember } }, { isOnline: 1, userName: 1, sharePermissionId: 1 }).then(async (listUser) => {
            if (listUser && listUser.length) {
              let senderName = listUser.find((e) => e._id == mess.SenderID) ? listUser.find((e) => e._id == mess.SenderID).userName : "";
              // customer -> ntd 
              if (conversation.isGroup == 0 && ([...new Set(listMember)].length == 2)) {
                for (let i = 0; i < listUser.length; i++) {
                  if (listUser[i]._id != SenderID) {
                    console.log('share', listUser[i])
                    if (listUser[i].sharePermissionId && listUser[i].sharePermissionId.length && !listUser[i].sharePermissionId.find((e) => e == SenderID)) {
                      let con = await Conversation.findOne(
                        {
                          adminId: listUser[i]._id,
                          isGroup: 1,
                          typeGroup: "SharePermission",
                          IdCustomer: SenderID
                        }, { _id: 1 }).lean();
                      let obj = req.body;
                      obj["FromClient"] = 'ok';
                      obj["SenderID"] = 59721;
                      if (con) {
                        // sendMessage -> Group by temp account
                        obj["ConversationID"] = con._id;
                        console.log('input', obj)
                        await axios({
                          method: "post",
                          url: "http://43.239.223.142:9000/api/message/SendMessage",
                          data: obj,
                          headers: { "Content-Type": "multipart/form-data" },
                        });
                        console.log("send successfully")
                      }
                      else {
                        // create con 
                        let memberList = [{
                          memberId: 59721,
                          notification: 1,
                          conversationName: `${senderName}-Hỗ trợ`,
                          unReader: 1,
                        },
                          // {
                          //   memberId: listUser[i]._id,
                          //   notification: 1,
                          //   conversationName:`Hỗ trợ-${senderName}`,
                          //   unReader:1,
                          // }
                        ];
                        let listUserShare = [...new Set(listUser[i].sharePermissionId)]
                        for (let i = 0; i < listUserShare.length; i++) {
                          memberList.push({
                            memberId: listUserShare[i],
                            notification: 1,
                            conversationName: `${senderName}-Hỗ trợ`,
                            unReader: 1,
                          },)
                        }
                        const bigestId = (
                          await Conversation.find().sort({ _id: -1 }).select("_id").limit(1).lean()
                        )[0]._id;
                        let newCon = new Conversation({
                          _id: bigestId + 1,
                          isGroup: 1,
                          adminId: listUser[i]._id,
                          typeGroup: "SharePermission",
                          IdCustomer: SenderID,
                          memberList: memberList,
                          messageList: [],
                          browseMemberList: [],
                          timeLastMessage: new Date(),
                          timeLastChange: new Date()
                        })
                        let savedCon = await newCon.save();
                        // send mess to group 

                        obj["ConversationID"] = savedCon._id;
                        console.log('input', obj)
                        await axios({
                          method: "post",
                          url: "http://43.239.223.142:9000/api/message/SendMessage",
                          data: obj,
                          headers: { "Content-Type": "multipart/form-data" },
                        });
                        console.log("send successfully")

                      }
                    }
                  }
                }
              }
              // supporter to customer 
              if (conversation.isGroup == 1 && (conversation.typeGroup == "SharePermission") && conversation.IdCustomer && conversation.adminId) {
                if (!req.body.FromClient) {
                  let ConId = await FCreateNewConversation(conversation.IdCustomer, conversation.adminId);
                  let obj = req.body;
                  obj["SenderID"] = conversation.adminId;
                  obj["ConversationID"] = ConId;
                  await axios({
                    method: "post",
                    url: "http://43.239.223.142:9000/api/message/SendMessage",
                    data: obj,
                    headers: { "Content-Type": "multipart/form-data" },
                  });
                  console.log("send successfully")
                }
              }
              for (let i = 0; i < listMember.length; i++) {
                let a = listUser.find((e) => e._id == listMember[i]);
                if (a) {
                  if (Number(a._id) !== SenderID) {
                    if (conversation.memberList.find((e) => e.memberId == listMember[i])) {
                      if (conversation.memberList.find((e) => e.memberId == listMember[i]).notification != 0) {
                        if ((a.isOnline) == 0 && Number(a._id) !== SenderID) {
                          listUserOffline.push(listMember[i]);
                        }
                        else if (!listOnline.find((e) => e == listMember[i])) {
                          listUserOffline.push(listMember[i]);
                        }
                      }
                    }
                  }
                }
              };
              if (listUserOffline.length) {
                if (!conversationName) {
                  conversationName = senderName;
                }
                if (req.body.MessageType == "text") {
                  axios({
                    method: "post",
                    url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                    data: {
                      IdReceiver: JSON.stringify(listUserOffline),
                      conversationId: ConversationID,
                      sendername: senderName,
                      ava: 'a',
                      mess: mess.Message,
                      type: 'text',
                      idSender: mess.SenderID,
                      mask: 1,
                      conversationName: conversationName
                    },
                    headers: { "Content-Type": "multipart/form-data" }
                  }).catch((e) => {
                    console.log(e)
                  })
                }
                else if (req.body.MessageType == "map") {
                  axios({
                    method: "post",
                    url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                    data: {
                      IdReceiver: JSON.stringify(listUserOffline),
                      conversationId: ConversationID,
                      sendername: senderName,
                      ava: 'a',
                      mess: 'Bạn đã nhận được 1 vị trí ',
                      type: 'text',
                      idSender: mess.SenderID,
                      mask: 1,
                      conversationName: conversationName
                    },
                    headers: { "Content-Type": "multipart/form-data" }
                  }).catch((e) => {
                    console.log(e)
                  })
                }
                else if (req.body.MessageType == "sendProfile") {
                  axios({
                    method: "post",
                    url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                    data: {
                      IdReceiver: JSON.stringify(listUserOffline),
                      conversationId: ConversationID,
                      sendername: senderName,
                      ava: 'a',
                      mess: 'Bạn đã nhận được 1 thẻ liên hệ',
                      type: 'text',
                      idSender: mess.SenderID,
                      mask: 1,
                      conversationName: conversationName
                    },
                    headers: { "Content-Type": "multipart/form-data" }
                  }).catch((e) => {
                    console.log(e)
                  })
                }
                else if (req.body.MessageType == "sendFile") {
                  axios({
                    method: "post",
                    url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                    data: {
                      IdReceiver: JSON.stringify(listUserOffline),
                      conversationId: ConversationID,
                      sendername: senderName,
                      ava: 'a',
                      mess: 'Bạn đã nhận được 1 file',
                      type: 'text',
                      idSender: mess.SenderID,
                      mask: 1,
                      conversationName: conversationName
                    },
                    headers: { "Content-Type": "multipart/form-data" }
                  }).catch((e) => {
                    console.log(e)
                  })
                }
                else if (req.body.MessageType == "notification") {
                  let mess_text = mess.Message;
                  if (mess_text.includes('was add friend to')) {
                    let name_user_first = listUser.find((e) => e._id == mess.SenderID).userName || "Người dùng Chat365";
                    let name_user_second = listUser.find((e) => e._id != mess.SenderID).userName || "Người dùng Chat365"
                    mess_text = `${name_user_first} đã gửi lời mời kết bạn đến ${name_user_second}`
                  }
                  axios({
                    method: "post",
                    url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                    data: {
                      IdReceiver: JSON.stringify(listUserOffline),
                      conversationId: ConversationID,
                      sendername: senderName,
                      ava: 'a',
                      mess: mess_text,
                      type: 'text',
                      idSender: mess.SenderID,
                      mask: 1,
                      conversationName: conversationName
                    },
                    headers: { "Content-Type": "multipart/form-data" }
                  }).catch((e) => {
                    console.log(e)
                  })
                }
                else {
                  axios({
                    method: "post",
                    url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                    data: {
                      IdReceiver: JSON.stringify(listUserOffline),
                      conversationId: ConversationID,
                      sendername: senderName,
                      ava: 'a',
                      mess: mess.Message,
                      type: 'text',
                      idSender: mess.SenderID,
                      mask: 1,
                      conversationName: conversationName
                    },
                    headers: { "Content-Type": "multipart/form-data" }
                  }).catch((e) => {
                    console.log(e)
                  })
                }
              }
            };
            return true;
          }).catch((e) => {
            console.log(e);
            return false;
          })
        }
        return true;
      }
      else {
        return res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
      };
    }
    else {
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  }
  catch (e) {
    console.log(e);
    return res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}
export const LoadMessageLiveChat = async (req, res, next) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status) {
        console.log("Token hop le, LoadMessageLiveChat")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body && req.body.clientId) {
      let countMess = await Conversation.aggregate([
        {
          $match:
          {
            $and: [
              { typeGroup: "liveChat" },
              { "memberList.liveChat.clientId": String(req.body.clientId) },
            ]
          }
        },
        {
          $project: {
            count: { $size: "$messageList" },
            "memberList.memberId": 1,
            "memberList.unReader": 1,
            "memberList.liveChat": 1,
            "memberList.timeLastSeener": 1,
            timeLastMessage: 1
          }
        }
      ]);
      let unReader;
      if (countMess && countMess.length > 0) {
        unReader = countMess[0].memberList.find((e) => e.liveChat != null).unReader || 0; // lay thong tin tin nhan chua doc 
        let sizeListMess = countMess[0].count - 1;
        let countMessLiveChat = req.body.countMess || 0;
        let step = Number(req.body.countLoad) || 10;

        let start = sizeListMess - step * countMessLiveChat - (step - 1);
        if (start < 0 && (countMessLiveChat * step <= sizeListMess)) {
          start = 0;
          step = sizeListMess - step * countMessLiveChat + 1;
        }

        let listMem = [];
        for (let i = 0; i < countMess[0].memberList.length; i++) {
          listMem.push(countMess[0].memberList[i].memberId)
        }

        let idLastSeen = countMess[0].memberList[0].memberId;
        if (countMess && countMess.length > 0 && countMess[0].memberList && countMess[0].memberList.length && (countMess[0].memberList.length > 1)) {
          if (new Date(countMess[0].memberList[0].timeLastSeener) < new Date(countMess[0].memberList[1].timeLastSeener)) {
            idLastSeen = countMess[0].memberList[1].memberId;
          };
        }
        let userLastSeen = await User.findOne({ _id: idLastSeen });
        let nameLastSeener = "Tổng đài hỗ trợ của HHP";
        let avatarLastSeener = `${urlImgHost()}avatar/T_3.png`;
        if (userLastSeen) {
          nameLastSeener = userLastSeen.userName;
          if (userLastSeen.avatarUser != "") {
            avatarLastSeener = `${urlImgHost}avatarUser/${userLastSeen._id}/${userLastSeen.avatarUser}`;
          }
          else {
            avatarLastSeener = `${urlImgHost}avatar/${userLastSeen.userName[0]}_${getRandomInt(1, 4)}.png`
          }
        }
        if (countMessLiveChat == 0 || (countMessLiveChat * step <= sizeListMess)) {
          Conversation.find({ _id: countMess[0]._id }, { messageList: { $slice: [start, step] } })
            .then(async (conversation) => {
              if (conversation) {
                if (conversation.length > 0) {
                  let ListMessFavour = [];
                  let ListMessFinal = [];
                  let ListMes = conversation[0].messageList;
                  for (let i = 0; i < ListMes.length; i++) {
                    if (!listMem.includes(ListMes[i].senderId)) {
                      listMem.push(ListMes[i].senderId);
                    }
                  }
                  let dataUsers = await User.find({ _id: { $in: listMem } }).limit(2);
                  for (let i = 0; i < ListMes.length; i++) {
                    let a = {};
                    a.messageID = ListMes[i]._id;
                    a.conversationID = Number(countMess[0]._id);
                    a.displayMessage = ListMes[i].displayMessage;
                    a.senderID = ListMes[i].senderId;
                    if (dataUsers.find((e) => e._id == a.senderID)) {
                      a.senderName = dataUsers.find((e) => e._id == a.senderID).userName || "";
                    }
                    else {
                      a.senderName = "";
                    }
                    a.isSeen = 0;
                    a.messageType = ListMes[i].messageType;
                    a.message = ListMes[i].message;
                    if (ListMes[i].quoteMessage && (ListMes[i].quoteMessage.trim() != "")) {
                      let conversationTakeMessage = await Conversation.aggregate([
                        {
                          $match:
                          {
                            _id: Number(conversation[0]._id)
                          }
                        },
                        {
                          $project: {
                            messageList: {
                              $slice: [
                                {
                                  $filter: {
                                    input: "$messageList",
                                    as: "messagelist",
                                    cond: {
                                      $eq: ["$$messagelist._id", ListMes[i].quoteMessage]
                                    },
                                  }
                                },
                                -1
                              ]
                            }
                          }
                        }
                      ])
                      if (conversationTakeMessage && conversationTakeMessage.length > 0 && conversationTakeMessage[0].messageList && conversationTakeMessage[0].messageList.length && (conversationTakeMessage[0].messageList.length > 0)) {
                        let message = conversationTakeMessage[0].messageList[0];
                        let senderData = await User.findOne({ _id: message.senderId }, { userName: 1 })
                        if (senderData && senderData.userName) {
                          a.quoteMessage = fMessageQuote(message._id, senderData.userName, message.senderId, message.messageType, message.message, message.createAt)
                        }
                      }
                    }
                    else {
                      a.quoteMessage = ListMes[i].quoteMessage;
                    }
                    a.messageQuote = ListMes[i].messageQuote;
                    a.createAt = `${JSON.parse(JSON.stringify(new Date(ListMes[i].createAt.setHours(ListMes[i].createAt.getHours() + 7)))).replace("Z", "")}+07:00`;

                    a.isEdited = ListMes[i].isEdited;
                    if (ListMes[i].infoLink) {
                      a.infoLink = fInfoLink(ListMes[i]._id, ListMes[i].infoLink.title, ListMes[i].infoLink.description, ListMes[i].infoLink.linkHome, ListMes[i].infoLink.image, ListMes[i].infoLink.isNotification);
                    }
                    else {
                      a.infoLink = ListMes[i].infoLink;
                    }
                    if (ListMes[i].listFile && ListMes[i].listFile.length && (ListMes[i].listFile.length > 0)) {
                      let listFileFirst = [];
                      for (let j = 0; j < ListMes[i].listFile.length; j++) {
                        listFileFirst.push(
                          fInfoFile(
                            ListMes[i].listFile[j].messageType,
                            ListMes[i].listFile[j].nameFile,
                            ListMes[i].listFile[j].sizeFile,
                            ListMes[i].listFile[j].height,
                            ListMes[i].listFile[j].width
                          ));
                      }
                      a.listFile = listFileFirst;
                    }
                    else {
                      a.listFile = [];
                    }
                    a.emotionMessage = [];
                    if (ListMes[i].emotion) {
                      if (String(ListMes[i].emotion.Emotion1).trim() != "") {
                        a.emotionMessage.push(fEmotion(1, ListMes[i].emotion.Emotion1.split(","), `${urlImgHost()}Emotion/Emotion1.png`))
                      }
                      if (String(ListMes[i].emotion.Emotion2).trim() != "") {
                        a.emotionMessage.push(fEmotion(2, ListMes[i].emotion.Emotion2.split(","), `${urlImgHost()}Emotion/Emotion2.png`))
                      }
                      if (String(ListMes[i].emotion.Emotion3).trim() != "") {
                        a.emotionMessage.push(fEmotion(3, ListMes[i].emotion.Emotion3.split(","), `${urlImgHost()}Emotion/Emotion3.png`))
                      }
                      if (String(ListMes[i].emotion.Emotion4).trim() != "") {
                        a.emotionMessage.push(fEmotion(4, ListMes[i].emotion.Emotion4.split(","), `${urlImgHost()}Emotion/Emotion4.png`))
                      }
                      if (String(ListMes[i].emotion.Emotion5).trim() != "") {
                        a.emotionMessage.push(fEmotion(5, ListMes[i].emotion.Emotion5.split(","), `${urlImgHost()}Emotion/Emotion5.png`))
                      }
                      if (String(ListMes[i].emotion.Emotion6).trim() != "") {
                        a.emotionMessage.push(fEmotion(6, ListMes[i].emotion.Emotion6.split(","), `${urlImgHost()}Emotion/Emotion6.png`))
                      }
                      if (String(ListMes[i].emotion.Emotion7).trim() != "") {
                        a.emotionMessage.push(fEmotion(7, ListMes[i].emotion.Emotion7.split(","), `${urlImgHost()}Emotion/Emotion7.png`))
                      }
                      if (String(ListMes[i].emotion.Emotion8).trim() != "") {
                        a.emotionMessage.push(fEmotion(8, ListMes[i].emotion.Emotion8.split(","), `${urlImgHost()}Emotion/Emotion8.png`))
                      }
                    }
                    else {
                      a.emotion = ListMes[i].emotion;
                      a.emotionMessage = [];
                    }
                    if (ListMes[i].messageType == "sendProfile") {
                      let userData = await User.findOne({ _id: ListMes[i].message });
                      if (userData && userData.userName) {
                        let b = {};
                        b.iD365 = userData.id365;
                        b.idTimViec = userData.idTimViec;
                        b.type365 = userData.type365;
                        b.password = "";
                        b.phone = userData.phone;
                        // b.notificationPayoff = userData.notificationPayoff;
                        b.notificationPayoff = 1
                        // b.notificationCalendar = userData.notificationCalendar;
                        b.notificationCalendar = 1
                        // b.notificationReport = userData.notificationReport;
                        b.notificationReport = 1
                        // b.notificationOffer = userData.notificationOffer;
                        b.notificationOffer = 1
                        // b.notificationPersonnelChange = userData.notificationPersonnelChange;
                        b.notificationPersonnelChange = 1
                        // b.notificationRewardDiscipline = userData.notificationRewardDiscipline;
                        b.notificationRewardDiscipline = 1
                        // b.notificationNewPersonnel = userData.notificationNewPersonnel;
                        b.notificationNewPersonnel = 1
                        // b.notificationChangeProfile = userData.notificationChangeProfile;
                        b.notificationChangeProfile = 1
                        // b.notificationTransferAsset = userData.notificationTransferAsset;
                        b.notificationTransferAsset = 1
                        b.acceptMessStranger = userData.acceptMessStranger;
                        b.type_Pass = 0;
                        b.companyName = userData.companyName;
                        b.secretCode = "";
                        b.notificationMissMessage = 0;
                        b.notificationCommentFromTimViec = 0;
                        b.notificationCommentFromRaoNhanh = 0;
                        b.notificationTag = 0;
                        b.notificationSendCandidate = 0;
                        b.notificationChangeSalary = 0;
                        b.notificationAllocationRecall = 0;
                        b.notificationAcceptOffer = 0;
                        b.notificationDecilineOffer = 0;
                        b.notificationNTDPoint = 0;
                        b.notificationNTDExpiredPin = 0;
                        b.notificationNTDExpiredRecruit = 0;
                        b.fromWeb = userData.fromWeb;
                        b.notificationNTDApplying = 0;
                        b.userQr = null;
                        b.id = userData._id;
                        b.email = userData.email;
                        b.userName = userData.userName;
                        b.avatarUser = userData.avatarUser;
                        b.status = userData.status;
                        b.active = userData.active;
                        b.isOnline = userData.isOnline;
                        b.looker = userData.looker;
                        b.statusEmotion = userData.statusEmotion;
                        b.lastActive = userData.lastActive;

                        if (String(userData.avatarUser).trim != "") {
                          b.linkAvatar = `${urlImgHost}avatarUser/${userData._id}/${userData.avatarUser}`;
                        }
                        else {
                          b.linkAvatar = `${urlImgHost}avatar/${userData.userName[0]}_${getRandomInt(1, 4)}.png`
                        }
                        b.companyId = userData.companyId;

                        let status = await RequestContact.findOne({
                          $or: [
                            { userId: Number(req.body.adminId), contactId: userData._id },
                            { userId: userData._id, contactId: Number(req.body.adminId) }
                          ]
                        });
                        if (status) {
                          if (status.status == "accept") {
                            b.friendStatus = "friend";
                          }
                          else {
                            b.friendStatus = status.status;
                          }
                        }
                        else {
                          b.friendStatus = "none";
                        }
                        a.userProfile = b;
                      }
                      else {
                        a.userProfile = null;
                      }
                    }
                    else {
                      a.userProfile = null;
                    }
                    a.listTag = null;
                    a.link = null;
                    a.file = a.listFile;
                    a.quote = null;
                    a.profile = a.userProfile;
                    a.deleteTime = ListMes[i].deleteTime;
                    a.deleteType = ListMes[i].deleteType;
                    a.deleteDate = String('0001-01-01T00:00:00.000+00:00');
                    a.infoSupport = ListMes[i].infoSupport;
                    if (ListMes[i].liveChat) {
                      a.liveChat = {};
                      a.liveChat.clientId = ListMes[i].liveChat.clientId;
                      a.liveChat.clientName = ListMes[i].liveChat.clientName;
                      a.liveChat.fromWeb = ListMes[i].liveChat.fromWeb;
                      a.liveChat.clientAvatar = `${urlImgHost()}avatar/${a.liveChat.clientName[0]}_4.png`;
                    }
                    else {
                      a.liveChat = null;
                    }
                    a.linkNotification = null;
                    a.isClicked = 0;
                    if (ListMes[i].notiClicked.includes(Number(req.body.adminId))) {
                      a.isClicked = 1;
                    }
                    if (ListMessFavour.includes(ListMes[i]._id)) {
                      a.IsFavorite = 1;
                    }
                    else {
                      a.IsFavorite = 0;
                    }
                    ListMessFinal.push(a)
                  }
                  let listMemberFinal = [];
                  for (let i = 0; i < countMess[0].memberList.length; i++) {
                    listMemberFinal.push(countMess[0].memberList[i].memberId)
                  }
                  return res.json({
                    data: {
                      result: true,
                      messsage: "Lấy danh sách tin nhắn thành công",
                      conversationId: countMess[0]._id,
                      listMember: listMemberFinal,
                      countMessage: ListMessFinal.length,
                      unReader: unReader,
                      message_info: null,
                      listMessages: ListMessFinal,
                      messageId: ListMessFinal[ListMessFinal.length - 1].messageID,
                      timeLastSeener: `${JSON.parse(JSON.stringify(new Date(countMess[0].timeLastMessage.setHours(countMess[0].timeLastMessage.getHours() + 7)))).replace("Z", "")}+07:00`,
                      nameLastSeener: nameLastSeener,
                      avatarLastSeener: avatarLastSeener
                    },
                    error: null
                  })
                }
                else {
                  res.status(200).json(createError(200, "Không tìm thấy cuộc trò chuyện thích hợp"));
                }
              }
            }).catch((e) => {
              console.log(e);
            });
        }
        else {
          res.json({
            data: {
              result: true,
              messsage: "Lấy danh sách tin nhắn thành công",
              conversationId: countMess[0]._id,
              listMember: listMem,
              countMessage: 0,
              unReader: unReader,
              message_info: null,
              listMessages: [],
              messageId: "",
              timeLastSeener: "",
              nameLastSeener: "",
              avatarLastSeener: ""
            },
            error: null
          })
        }
      }
      else {
        res.status(200).json(createError(200, "Không có cuộc trò chuyện live chat"));
      }
    }
    else {
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  }
  catch (e) {
    console.log(e);
    res.status(200).json(createError(200, "Chua co cuoc tro chuyen"));
  }
}

// bắt tin nhắn live Chat 
export const UpdateSupportStatusMessage = async (req, res) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.userId)) {
        console.log("Token hop le, UpdateSupportStatusMessage")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body && req.body.clientId && req.body.userId && req.body.status && req.body.conversationId
      && (!isNaN(req.body.userId)) && (!isNaN(req.body.status) && (!isNaN(req.body.conversationId)) && (Number(req.body.conversationId) > 0))
    ) {
      Conversation.updateOne(
        { _id: req.body.conversationId },
        {
          "$set": {
            timeLastChange: Date.now(),
            "messageList.$[elem].infoSupport.status": Number(req.body.status),
            "messageList.$[elem].infoSupport.userId": Number(req.body.userId),
          }
        },
        { "arrayFilters": [{ "elem.liveChat.clientId": req.body.clientId }], "multi": true }
      )
        .catch((e) => (console.log(e)));
      Conversation.updateOne(
        { _id: req.body.conversationId },
        {
          "$pull": {
            "messageList": { "liveChat.clientId": req.body.clientId }
          }
        },
      )
        .catch((e) => (console.log(e)));
      res.json({
        data: {
          message: "Cập nhật thành công",
          result: true,
        },
        error: null
      })
    }
    else {
      res.status(200).json(createError(200, "Thiếu thông tin truyền lên"));
    }
  }
  catch (e) {
    console.log(e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

//sinh nhaatj
// cron.schedule('30 7 * * *', async (req, res, next) => {
//   try {

//     let listId = []
//     let dateYear = new Date().getFullYear();
//     let dateMonth = new Date().getMonth() + 1;
//     let dateDay = new Date().getDate();
//     if (Number(dateMonth) < 10) {
//       dateMonth = String('0' + dateMonth)
//     }
//     if (Number(dateDay) < 10) {
//       dateDay = String('0' + dateDay)
//     }
//     const birthdays = await Birthday.find({})
//     for (let i = 0; i < birthdays.length; i++) {
//       const arr = birthdays[i].Dob.split("-");
//       if (dateDay == String(arr[0]) && dateMonth == String(arr[1])) {
//         listId.push(birthdays[i].UserId)
//       }
//     }
//     console.log(listId)
//     for (let i = 0; i < listId.length; i++) {
//       let user = await Birthday.findOne({ UserId: listId[i] }).lean()
//       let listConversationId = await Conversation.find({
//         "memberList.memberId": listId[i],
//       }, { _id: 1 }).lean()
//       for (let j = 0; j < listConversationId.length; j++) {
//         console.log(listConversationId[j]._id)
//         let sendmes = await axios({
//           method: "post",
//           url: "http://43.239.223.142:9000/api/message/SendMessage",
//           data: {
//             ConversationID: listConversationId[j]._id,
//             SenderID: listId[i],
//             MessageType: "notification",
//             Message: `hôm nay là sinh nhật của ${user.userName} , hãy gửi lời chúc mừng đến người ấy nào`
//           },
//           headers: { "Content-Type": "multipart/form-data" }
//         });
//         socket.emit("CheckBirthday", listId[i], listConversationId[j]._id, user.userName)
//       }
//     }

//     res.status(200).json({
//       data: {
//         result: true,
//         message: "gui thong bao sinh nhat thanh cong",
//       },
//       error: null
//     });
//   }
//   catch (e) {
//     {
//       res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
//     }
//   }
// })

// cron.schedule('03 16 * * *', async (req, res, next) => {
//   try {

//     let listId = []
//     let dateYear = new Date().getFullYear();
//     let dateMonth = new Date().getMonth() + 1;
//     let dateDay = new Date().getDate();
//     if (Number(dateMonth) < 10) {
//       dateMonth = String('0' + dateMonth)
//     }
//     if (Number(dateDay) < 10) {
//       dateDay = String('0' + dateDay)
//     }
//     const birthdays = await Birthday.find({}).lean()
//     for (let i = 0; i < birthdays.length; i++) {
//       const arr = birthdays[i].Dob.split("-");
//       if (dateDay == String(arr[0]) && dateMonth == String(arr[1])) {
//         listId.push(birthdays[i].UserId)
//       }
//     }
//     console.log(listId)
//     for (let i = 0; i < listId.length; i++) {
//       let user = await Birthday.findOne({ UserId: listId[i] }).lean()
//       let listConversationId = await Conversation.find({
//         "memberList.memberId": listId[i],
//       }, { _id: 1 }).lean()
//       for (let j = 0; j < listConversationId.length; j++) {
//         console.log(listConversationId[j]._id)
//         let findmess = await Conversation.findOne({ _id: listConversationId[j]._id }, { "messageList._id": 1, "messageList.messageType": 1, "messageList.message": 1 }).lean()

//         let messageIndex = findmess.messageList.findIndex(
//           (e) => e.messageType == "notification" && e.message == `hôm nay là sinh nhật của ${user.userName} , hãy gửi lời chúc mừng đến người ấy nào`
//         )
//         console.log(messageIndex)
//         console.log(messageIndex)
//         if (messageIndex >= 0) {
//           let deletemess = await axios({
//             method: "post",
//             url: "http://43.239.223.142:9000/api/message/DeleteMessage",
//             data: {
//               MessageID: findmess.messageList[messageIndex]._id,
//               ConversationID: listConversationId[j]._id,
//             },
//             headers: { "Content-Type": "multipart/form-data" },
//           });
//         }
//       };

//     }

//     res.status(200).json({
//       data: {
//         result: true,
//         message: "Xoas tin nhan thong bao sinh nhat thanh cong",
//       },
//       error: null
//     });
//   }
//   catch (e) {
//     {
//       res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
//     }
//   }
// })

//check sinh nhật
export const checkBirthday = async (req, res, next) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status) {
        console.log("Token hop le, checkBirthday")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req && req.body) {
      let tag = [];
      if (!req.body.listId.includes("[")) {
        tag = req.body.listId;
      } else {
        let string = String(req.body.listId).replace("[", "");
        string = String(string).replace("]", "");
        let list = string.split(",");
        for (let i = 0; i < list.length; i++) {
          if (Number(list[i])) {
            tag.push(Number(list[i]));
          }
        }
      }

      let dateMonth = new Date().getMonth() + 1;
      let dateDay = new Date().getDate();
      let check = []
      const birthdays = await Birthday.find({ UserId: { $in: tag } })
      for (let i = 0; i < birthdays.length; i++) {
        const arr = birthdays[i].Dob.split("-");
        if (dateDay === Number(arr[0]) && dateMonth === Number(arr[1])) {
          check.push(birthdays[i].UserId)
        }
      }
      const find = await Birthday.find({ UserId: { $in: check } }).lean()
      const user = await User.find({ _id: { $in: check } }, { userName: 1, avatarUser: 1 }).lean()
      for (let i = 0; i < find.length; i++) {
        if (find[i].avatarUser !== "") {
          find[i].avatarUser = `${urlImgHost}avatarUser/${find[i].UserId}/${find[i].avatarUser}`;
        } else {
          find[i].avatarUser = `${urlImgHost}avatar/${find[i].userName
            }_${Math.floor(Math.random() * 4) + 1}.png`;
        }

      }
      if (find) {
        res.status(200).json({
          data: {
            result: find,
            message: "Lấy thông tin sinh nhật thành công",
          },
          error: null
        });
      }
    }
    else {
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  }
  catch (e) {
    console.log(e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

//danh sách người nhận dc yêu cầu gửi tin nhắn sinh nhật cho bạn mình
export const personSendBirthday = async (req, res, next) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status) {
        console.log("Token hop le, personSendBirthday")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req && req.body) {
      let list1 = [];
      if (!req.body.listId.includes("[")) {
        list1 = req.body.listId;
      } else {
        let string = String(req.body.listId).replace("[", "");
        string = String(string).replace("]", "");
        let list = string.split(",");
        for (let i = 0; i < list.length; i++) {
          if (Number(list[i])) {
            list1.push(Number(list[i]));
          }
        }
      }

      let dateMonth = new Date().getMonth() + 1;
      let dateDay = new Date().getDate();
      let check = []
      const birthdays = await Birthday.find({ UserId: { $in: list1 } }).lean()
      for (let i = 0; i < birthdays.length; i++) {
        const arr = birthdays[i].Dob.split("-");
        if (dateDay === Number(arr[0]) && dateMonth === Number(arr[1])) {
          check.push(birthdays[i].UserId)
        }
      }
      const find = await User.find({ _id: { $in: check } }, { userName: 1 })

      let conversation = await Conversation.find({ "memberList.memberId": { $in: check } },
        { "memberList.memberId": 1 }).lean()

      let ListUser1 = [];// danh sách bạn bè của người sinh nhật



      if (conversation) {
        for (let i = 0; i < conversation.length; i++) {
          if (conversation[i] && conversation[i].memberList && conversation[i].memberList.length && (conversation[i].memberList.length > 0)) {
            for (let j = 0; j < conversation[i].memberList.length; j++) {
              if ((!isNaN(conversation[i].memberList[j].memberId)) && (!check.includes(conversation[i].memberList[j].memberId)) && (!ListUser1.includes(conversation[i].memberList[j].memberId))) {
                ListUser1.push(conversation[i].memberList[j].memberId);
                // ListUser2 = ListUser1.map(e => 
                //   e = {
                //     id: e,
                //     type: 0
                //   }
                // )
              }
            }
          }
        }

      };

      if (find) {
        res.status(200).json({
          data: {
            result: ListUser1,
            message: "Lấy thông tin sinh nhật thành công",
          },
          error: null
        });
      }
    }
    else {
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  }
  catch (e) {
    console.log(e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

//check xem người nhận dc yêu cầu gửi tin nhắn sinh nhật đã gửi tin nhắn cho bạn mình hay chưa
export const checkPersonSendBirthday = async (req, res, next) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.userId1)) {
        console.log("Token hop le, checkPersonSendBirthday")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req && req.body && (Number(req.body.userId1) && Number(req.body.userId2))) {
      const userId1 = req.body.userId1
      const userId2 = req.body.userId2

      const find = await User.findOne({ _id: req.body.userId1 }, { userName: 1, avatarUser: 1 }).lean()




      let update = await Birthday.findOneAndUpdate({ UserId: userId1 }, { $push: { birthdayList: userId2 } }, { new: true })

      if (update.avatarUser !== "") {
        update.avatarUser = `${urlImgHost}avatarUser/${find._id}/${update.avatarUser}`;
      } else {
        update.avatarUser = `${urlImgHost}avatar/${update.userName
          }_${Math.floor(Math.random() * 4) + 1}.png`;
      }
      if (update) {
        res.status(200).json({
          data: {
            result: update,
            message: "Lấy thông tin sinh nhật thành công",
          },
          error: null
        });
      }
    }
    else {
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  }
  catch (e) {
    console.log("checkPersonSendBirthday,hùng", e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}
// cron.schedule('37 8 * * *', async (req, res, next) => {
//   try {
//     let find = await Birthday.find({}).lean()

//     let update

//     for (let i = 0; i < find.length; i++) {

//       update = await Birthday.updateMany({}, { $set: { birthdayList: [] } })

//     }

//     if (find && update) {
//       console.log("xóa danh sách người gửi tin nhắn sinh nhật thành công")
//     }
//   }
//   catch (e) {
//     {
//       console.log("cron, hùng", e);
//       res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
//     }
//   }
// })

export const RaoNhanhSendMessageToHHP = async (req, res, next) => {
  try {
    if (req && req.body) {
      let create = await axios({
        method: "post",
        url: "http://43.239.223.142:9000/api/conversations/CreateNewConversation",
        data: {
          userId: 56387,
          contactId: 78007
        },
        headers: { "Content-Type": "multipart/form-data" }
      });


      if (create) {

        let sendmes = await axios({
          method: "post",
          url: "http://43.239.223.142:9000/api/message/SendMessage",
          data: {
            ConversationID: create.data.data.conversationId,
            SenderID: 78007,
            MessageType: req.body.MessageType,
            Message: req.body.Message,

          },
          headers: { "Content-Type": "multipart/form-data" }
        });

      }
      if (create) {
        res.status(200).json({
          data: {
            result: true,
            message: "Gửi tin nhắn thành công",
          },
          error: null
        });
      }
    }
    else {
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  }
  catch (e) {
    console.log("raonhanh,hung", e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

export const SendVoice = async (req, res, next) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.senderId)) {
        console.log("Token hop le, SendVoice")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body.conversationId && req.body.senderId) {
      let files = [];
      const conversationId = Number(req.body.conversationId)
      const senderId = Number(req.body.senderId)

      for (let i = 0; i < req.files.length; i++) {
        let FileSizeInByte = Number(req.files[i].size);
        if (Number(req.files[i].size) < 1024) {
          FileSizeInByte = `${FileSizeInByte} bytes`;
        }
        else if ((Number(req.files[i].size) / 1024 >= 1) && (Number(req.files[i].size) / 1024 < 1024)) {
          FileSizeInByte = `${String(FileSizeInByte / 1024).split(".")[0]}.${String((FileSizeInByte / 1024) / 1024).split(".")[1].slice(0, 2)} KB`
        }
        else if ((Number(req.files[i].size) / 1024) / 1024 >= 1) {
          FileSizeInByte = `${String((FileSizeInByte / 1024) / 1024).split(".")[0]}.${String((FileSizeInByte / 1024) / 1024).split(".")[1].slice(0, 2)} MB`
        }
        const file = {
          TypeFile: 'sendVoice',
          FullName: req.files[i].filename,
          FileSizeInByte: FileSizeInByte,
          Height: 0,
          Width: 0,
          SizeFile: req.files[i].size,
          NameDisplay: req.files[i].filename
        }
        files.push(file)
      }
      console.log(files)
      let sendmess = await axios({
        method: "post",
        url: "http://43.239.223.142:9000/api/message/SendMessage",
        data: {
          'ConversationID': conversationId,
          'SenderID': senderId,
          'MessageType': "sendVoice",
          'File': JSON.stringify(files),
        },
        headers: { "Content-Type": "multipart/form-data" }
      })
      if (sendmess.data.data) {
        res.json({
          data: {
            result: true,
            message: "Gửi tin nhắn thoại thành công",
          },
          error: null
        })
      }
      else {
        res.status(200).json(createError(200, "Gửi tin nhắn thoại thất bại"));
      }
    }
    else {
      res.status(200).json(createError(200, "Thiếu thông tin truyền lên"));
    }
  } catch (err) {
    console.log(err)
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}


// export const DeleteMessageOneSide = async (req, res) => {
//   try {
//     if (req.body.token) {
//       let check = await checkToken(req.body.token);

//       if (check && check.status) {
//         console.log("Token hop le, DeleteMessageOneSide")
//       }
//       else {
//         return res.status(404).json(createError(404, "Invalid token"));
//       }
//     }
//     const conversationID = Number(req.body.ConversationID) || "";
//     const messageId = req.body.MessageID || "";
//     const userId = req.body.userId
//     let findconv = await Conversation.findOne({ _id: conversationID }, { "messageList.listDeleteUser": 1 })
//     let messageIndex = findconv.messageList.findIndex(
//       (e) => e._id = messageId
//     )
//     if (!(conversationID && messageId)) {
//       return res.send(createError(200, "Thiếu thông tin truyền lên"));
//     }
//     const filter = {
//       _id: conversationID,
//       messageList: { $elemMatch: { _id: { $eq: messageId } } },
//     };
//     const update = {
//       "messageList.$.isEdited": 2,
//       timeLastChange: Date.now(),
//       $push: {
//         "messageList.$.listDeleteUser": Number(userId)
//       }
//     };

//     if (!findconv.messageList[messageIndex].listDeleteUser.includes(userId)) {

//       const exCons = await Conversation.findOneAndUpdate(filter, update);
//       if (!exCons) return res.send(createError(200, "Tin nhắn không tồn tại"));
//     }
//     else {
//       return res.send(createError(200, "Người này đã xóa tin nhắn này rồi"));
//     }

//     const data = {
//       result: true,
//       message: "Xoá tin nhắn thành công",
//     };
//     return res.send({ data, error: null });
//   } catch (err) {
//     console.log(err);
//     if (err) return res.send(createError(200, err.message));
//   }
// };

export const DeleteMessageOneSide = async (req, res) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);

      if (check && check.status) {
        console.log("Token hop le, DeleteMessageOneSide")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    const conversationID = Number(req.body.ConversationID) || "";
    const messageId = req.body.MessageID || "";
    const userId = Number(req.body.userId)


    if (!(conversationID && messageId)) {
      return res.send(createError(200, "Thiếu thông tin truyền lên"));
    }

    let prev = null, next = null

    const res1 = await Conversation.aggregate([
      {
        $match:
        {
          _id: conversationID,
        },
      },
      {
        $project:
        {
          memberList: 1,

          index: {
            $indexOfArray: [
              "$messageList._id",
              messageId,
            ],
          },
          size: {
            $size: "$messageList",
          },
          message: {
            $filter: {
              input: "$messageList",
              as: "messagelist",
              cond: {
                $eq: [
                  "$$messagelist._id",
                  messageId,
                ],
              },
            },
          },
        },
      },
    ])


    if (res1[0].index === 0 && res1[0].size !== 1) {
      const data = await Conversation.aggregate([
        {
          $match: {
            _id: conversationID
          }
        },
        {
          $project: {
            next: { $arrayElemAt: ['$messageList', res1[0].index + 1] }
          }
        }
      ])
      next = data[0].next
    }
    else if (res1[0].index === res1[0].size - 1 && res1[0].size !== 1) {
      const data = await Conversation.aggregate([
        {
          $match: {
            _id: conversationID
          }
        },
        {
          $project: {
            prev: { $arrayElemAt: ['$messageList', res1[0].index - 1] }
          }
        }
      ])
      prev = data[0].prev
    }
    else if (res1[0].size !== 1) {
      const data = await Conversation.aggregate([
        {
          $match: {
            _id: conversationID
          }
        },
        {
          $project: {
            next: { $arrayElemAt: ['$messageList', res1[0].index + 1] },
            prev: { $arrayElemAt: ['$messageList', res1[0].index - 1] }
          }
        }
      ])
      next = data[0].next
      prev = data[0].prev

    }

    if (res1[0].message[0].messageType === 'link') {

      if (!prev.listDeleteUser.includes(userId)) {
        //Xóa tin nhắn trước đó
        Conversation.updateOne(
          { _id: conversationID, "messageList._id": prev._id },
          {
            $set: {
              "messageList.$.isEdited": 2,
              timeLastChange: Date.now()
            },
            $push: {
              "messageList.$.listDeleteUser": Number(userId)
            }

          }
        ).catch((e) => { console.log(e) })
      }
      else {
        return res.send(createError(200, "Người này đã xóa tin nhắn này rồi"));
      }
      if (!res1[0].message[0].listDeleteUser.includes(userId)) {

        Conversation.updateOne(
          { _id: conversationID, "messageList._id": messageId },
          {
            $set: {
              "messageList.$.isEdited": 2,
              timeLastChange: Date.now()
            },
            $push: {
              "messageList.$.listDeleteUser": Number(userId)
            }

          }
        ).catch((e) => { console.log(e) })
      }
      else {
        return res.send(createError(200, "Người này đã xóa tin nhắn này rồi"));
      }

      const messageInfo = {
        ConversationID: Number(conversationID),
        MessageID: messageId,
      }
      const messageInfo1 = {
        ConversationID: Number(conversationID),
        MessageID: prev._id,
      }
      socket.emit('DeleteMessage', messageInfo, [userId])
      socket.emit('DeleteMessage', messageInfo1, [userId])
    }
    else if (res1[0].message[0].messageType === 'text' && next && next.messageType === 'link') {
      if (!res1[0].message[0].listDeleteUser.includes(userId)) {

        Conversation.updateOne(
          { _id: conversationID, "messageList._id": messageId },
          {
            $set: {
              "messageList.$.isEdited": 2,
              timeLastChange: Date.now()
            },
            $push: {
              "messageList.$.listDeleteUser": Number(userId)
            }
          }
        ).catch((e) => { console.log(e) })
      }
      else {
        return res.send(createError(200, "Người này đã xóa tin nhắn này rồi"));
      }
      if (!next.listDeleteUser.includes(userId)) {

        Conversation.updateOne(
          { _id: conversationID, "messageList._id": next._id },
          {
            $set: {
              "messageList.$.isEdited": 2,
              timeLastChange: Date.now()
            },
            $push: {
              "messageList.$.listDeleteUser": Number(userId)
            }
          }
        ).catch((e) => { console.log(e) })
      }
      else {
        return res.send(createError(200, "Người này đã xóa tin nhắn này rồi"));
      }
      const messageInfo = {
        ConversationID: Number(conversationID),
        MessageID: messageId
      }
      const messageInfo1 = {
        ConversationID: Number(conversationID),
        MessageID: next._id
      }
      socket.emit('DeleteMessage', messageInfo, [userId])
      socket.emit('DeleteMessage', messageInfo1, [userId])
    }
    else {
      const filter = {
        _id: conversationID,
        messageList: { $elemMatch: { _id: { $eq: messageId } } },
      };
      const update = {
        "messageList.$.isEdited": 2,
        timeLastChange: Date.now(),
        $push: {
          "messageList.$.listDeleteUser": Number(userId)
        }
      };
      const messageInfo = {
        ConversationID: Number(conversationID),
        MessageID: messageId
      }
      socket.emit('DeleteMessage', messageInfo, [userId])
      if (!res1[0].message[0].listDeleteUser.includes(userId)) {

        const exCons = await Conversation.findOneAndUpdate(filter, update);
        if (!exCons) return res.send(createError(200, "Tin nhắn không tồn tại"));
      }
      else {
        return res.send(createError(200, "Người này đã xóa tin nhắn này rồi"));
      }
    }

    const data = {
      result: true,
      message: "Xoá tin nhắn thành công",
    };
    return res.send({ data, error: null });
  } catch (err) {
    console.log(err);
    if (err) return res.send(createError(200, err.message));
  }
};

export const SuggestMessage = async (req, res) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status) {
        console.log("Token hop le, SuggestMessage")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    const findWord = req.body.findWord
    const conversationId = Number(req.body.conversationId)
    const final = []
    if (findWord.includes(' ')) {
      return res.status(200).json(createError(200, "Từ khóa không được có khoảng trắng"))
    }

    let count = 0
    while (final.length !== 5) {
      const result = await Conversation.aggregate([
        {
          $match: {
            _id: conversationId,
          },
        },
        {
          $project: {
            _id: 0,
            messageList: {
              $filter: {
                input: "$messageList",
                as: "messageList",
                cond: {
                  $eq: [
                    "$$messageList.messageType",
                    "text",
                  ],
                },
              },
            },
          },
        },
        {
          $unwind: {
            path: "$messageList",
          },
        },
        {
          $match: {
            "messageList.message": {
              $regex: findWord,
              $options: 'i'
            },
          },
        },
        {
          $sort: {
            "messageList.createAt": -1,
          },
        },
        {
          $skip:
            count,
        },
        {
          $limit: 5,
        },
        {
          $project: {
            message: "$messageList.message",
          },
        },
      ])
      for (let i = 0; i < result.length; i++) {
        const arr = result[i].message.split(' ')
        for (let j = 0; j < arr.length; j++) {
          if (arr[j] !== findWord && arr[j].includes(findWord) && !final.includes(arr[j])) {
            final.push(arr[j])
          }
          if (final.length === 5) break
        }
        if (final.length === 5) break
      }
      if (result.length < 5) break
      count = count + 5
    }
    res.json({
      data: {
        result: true,
        message: "Lấy thông tin thành công",
        data: final
      },
      error: null
    })
  } catch (err) {
    console.log(err)
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"))
  }
}

export const ShareAvatar = async (req, res) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.senderId)) {
        console.log("Token hop le, ShareAvatar")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body.userId && req.body.senderId & req.body.conversationId) {
      const userId = Number(req.body.userId)
      const senderId = Number(req.body.senderId)
      const conversationId = Number(req.body.conversationId)

      const user = await User.findOne({ _id: userId }, { avatarUser: 1 })

      if (!user) {
        return res.status(200).json(createError(200, "Thông tin không chính xác"))
      }
      if (user.avatarUser == '') {
        return res.status(200).json(createError(200, "Người dùng chưa cập nhật Avatar"))
      }
      const fileName = user.avatarUser.replace('_', '-')
      fs.writeFileSync(`C:/Chat365/publish/wwwroot/uploads/${fileName}`, fs.readFileSync(`C:/Chat365/publish/wwwroot/avatarUser/${user._id}/${user.avatarUser}`))
      const sizeFile = fs.statSync(`C:/Chat365/publish/wwwroot/uploads/${fileName}`).size
      let FileSizeInByte = Number(sizeFile);
      if (Number(sizeFile) < 1024) {
        FileSizeInByte = `${FileSizeInByte} bytes`;
      }
      else if ((Number(sizeFile) / 1024 >= 1) && (Number(sizeFile) / 1024 < 1024)) {
        FileSizeInByte = `${String(FileSizeInByte / 1024).split(".")[0]}.${String((FileSizeInByte / 1024) / 1024).split(".")[1].slice(0, 2)} KB`
      }
      else if ((Number(sizeFile) / 1024) / 1024 >= 1) {
        FileSizeInByte = `${String((FileSizeInByte / 1024) / 1024).split(".")[0]}.${String((FileSizeInByte / 1024) / 1024).split(".")[1].slice(0, 2)} MB`
      }
      const file = [{
        TypeFile: 'sendPhoto',
        FullName: fileName,
        FileSizeInByte: FileSizeInByte,
        Height: 250,
        Width: 250,
        SizeFile: sizeFile,
        NameDisplay: fileName
      }]
      let sendmess = await axios({
        method: "post",
        url: "http://43.239.223.142:9000/api/message/SendMessage",
        data: {
          'ConversationID': conversationId,
          'SenderID': senderId,
          'MessageType': "sendPhoto",
          'File': JSON.stringify(file),
        },
        headers: { "Content-Type": "multipart/form-data" }
      })
      if (sendmess.data.data) {
        res.json({
          data: {
            result: true,
            message: "Gửi ảnh Avatar thành công",
          },
          error: null
        })
      }
      else {
        res.status(200).json(createError(200, "Gửi ảnh Avatar thất bại"));
      }
    }
    else {
      res.status(200).json(createError(200, "Thiếu thông tin truyền lên"))
    }
  } catch (err) {
    console.log('Tiến ShareAvatar:\n', err)
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"))
  }
}

export const pinMessageV2 = async (req, res) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status) {
        console.log("Token hop le, pinMessageV2")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req && req.body && req.body.listpinId) {
      let listId = [];
      if (!req.body.listpinId.includes("[")) {
        listId = req.body.listpinId;
      } else {
        let string = String(req.body.listpinId).replace("[", "");
        string = String(string).replace("]", "");
        let list = string.split(",");
        for (let i = 0; i < list.length; i++) {
          listId.push(String(list[i]));
        }
      }
      let updatepinmess = await Conversation.findOneAndUpdate({ _id: req.body.conversationId }, { pinMessage: listId.join(), timeLastChange: Date.now() })

      if (updatepinmess) {
        res.status(200).json({
          data: {
            result: true,
            message: "lấy ra danh sách tin nhắn đã ghim thành công",
          },
          error: null
        });
      } else res.status(200).json(createError(200, "cập nhật không thành công"));
    } else res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));

  } catch (err) {
    console.log(err);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
};

//tesst sinh nhat
export const testBirthday = async (req, res, next) => {
  try {

    let dateYear = new Date().getFullYear();
    let dateMonth = new Date().getMonth() + 1;
    let dateDay = new Date().getDate();
    if (Number(dateMonth) < 10) {
      dateMonth = String('0' + dateMonth)
    }
    if (Number(dateDay) < 10) {
      dateDay = String('0' + dateDay)
    }

    const birthdays = await Birthday.find({ UserId: req.body.userId }).lean()

    for (let i = 0; i < birthdays.length; i++) {
      const arr = birthdays[i].Dob.split("-");
      let listConversationId = await Conversation.find({
        "memberList.memberId": birthdays[i].UserId,
        isGroup: 0
      }, { _id: 1 }
      ).lean();
      console.log(listConversationId)
      if (dateDay == String(arr[0]) && dateMonth == String(arr[1])) {
        for (let j = 0; j < listConversationId.length; j++) {
          console.log(listConversationId[j]._id)
          let sendmes = await axios({
            method: "post",
            url: "http://43.239.223.142:9000/api/message/SendMessage",
            data: {
              ConversationID: listConversationId[j]._id,
              SenderID: birthdays[i].UserId,
              MessageType: "notification",
              Message: `test`
            },
            headers: { "Content-Type": "multipart/form-data" }
          });
          if (sendmes) {

          }
        }
      }

    }
    res.status(200).json({
      data: {
        result: true,
        message: "gui thong bao sinh nhat thanh cong",
        result
      },
      error: null
    });
  }
  catch (e) {
    {
      res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
  }
}


export const SetDeleteDate = async (req, res) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status) {
        console.log("Token hop le, SetDeleteDate")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body.MessageID && req.body.ConversationID && req.body.DeleteDate) {
      const messageId = req.body.MessageID
      const conversationId = Number(req.body.ConversationID)
      const deleteDate = new Date(req.body.DeleteDate)

      const result = await Conversation.findOneAndUpdate({ _id: conversationId, 'messageList._id': messageId }, { 'messageList.$.deleteDate': deleteDate }, { projection: { _id: 1 } })
      if (result) {
        res.json({
          data: {
            result: true,
            message: "Cập nhật ngày xóa thành công",
          },
          error: null
        })
      }
      else {
        res.status(200).json(createError(200, "Tin nhắn không tồn tại hoặc không đúng dạng tin nhắn"))
      }
    }
    else {
      res.status(200).json(createError(200, "Thiếu thông tin truyền lên"))
    }
  } catch (err) {
    console.log(err)
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"))
  }
}

export const LoadMessageV2 = async (req, res, next) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status) {
        console.log("Token hop le, LoadMessageV2")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body && req.body.conversationId && (!isNaN(req.body.conversationId)) && Number(req.body.conversationId)) {
      let listMess = Number(req.body.listMess) || 0;
      let start = listMess;
      if (start < 0) {
        start = 0;
      }
      let conversation = await Conversation.find({ _id: Number(req.body.conversationId) }, { messageList: { $slice: [start, 16] }, "memberList.favoriteMessage": 1, "memberList.memberId": 1 }).lean()

      if (conversation) {
        if (conversation.length > 0) {
          let ListMessFavour = [];
          if (req.body.adminId && (!isNaN(req.body.adminId))) {
            if (conversation[0].memberList && conversation[0].memberList.length && (conversation[0].memberList.length > 0) && (conversation[0].memberList.findIndex((e) => e.memberId == Number(req.body.adminId)) != -1)) {
              let memberInfor = conversation[0].memberList.find((e) => e.memberId == Number(req.body.adminId));
              if (memberInfor && memberInfor.memberId) {
                ListMessFavour = memberInfor.favoriteMessage || [];
              }
            }
          }

          let ListMessFinal = [];
          let ListMes = conversation[0].messageList;
          for (let i = 0; i < ListMes.length; i++) {
            if (ListMes[i]._id && ListMes[i].senderId && ListMes[i].messageType) {
              let a = {};
              a.messageID = ListMes[i]._id;
              a.conversationID = Number(req.body.conversationId);
              a.displayMessage = ListMes[i].displayMessage || 0;
              a.senderID = ListMes[i].senderId;
              a.messageType = ListMes[i].messageType;
              a.message = ListMes[i].message || "";
              a.uscid = ListMes[i].uscid || "";
              if (ListMes[i].quoteMessage && (ListMes[i].quoteMessage.trim() != "")) {
                let conversationTakeMessage = await Conversation.aggregate([
                  {
                    $match:
                    {
                      "messageList._id": ListMes[i].quoteMessage
                    }
                  },
                  {
                    $project: {
                      messageList: {
                        $slice: [
                          {
                            $filter: {
                              input: "$messageList",
                              as: "messagelist",
                              cond: {
                                $eq: ["$$messagelist._id", ListMes[i].quoteMessage]
                              },
                            }
                          },
                          -1
                        ]
                      }
                    }
                  }
                ])
                if (conversationTakeMessage && conversationTakeMessage.length > 0 && conversationTakeMessage[0].messageList && conversationTakeMessage[0].messageList.length && (conversationTakeMessage[0].messageList.length > 0)) {
                  let message = conversationTakeMessage[0].messageList[0];
                  let senderData = await User.findOne({ _id: message.senderId }, { userName: 1 })
                  if (senderData && senderData.userName && message._id && message.senderId && message.createAt) {
                    a.quoteMessage = fMessageQuote(message._id, senderData.userName, message.senderId, message.messageType || "text", message.message, message.createAt)
                  }
                  else {
                    a.quoteMessage = null;
                  }
                }
                else {
                  a.quoteMessage = fMessageQuote(ListMes[i].quoteMessage, "", -1, "text", "", `${JSON.parse(JSON.stringify(new Date(ListMes[i].createAt.setHours(ListMes[i].createAt.getHours() + 7)))).replace("Z", "")}+07:00`)
                }
              }
              else {
                a.quoteMessage = null;
              }
              a.messageQuote = ListMes[i].messageQuote || "";
              a.createAt = `${JSON.parse(JSON.stringify(new Date(ListMes[i].createAt.setHours(ListMes[i].createAt.getHours() + 7)))).replace("Z", "")}+07:00`;
              a.isEdited = ListMes[i].isEdited || 0;
              if (ListMes[i].infoLink) {
                a.infoLink = fInfoLink(ListMes[i]._id, ListMes[i].infoLink.title, ListMes[i].infoLink.description, ListMes[i].infoLink.linkHome, ListMes[i].infoLink.image, ListMes[i].infoLink.isNotification);
              }
              else {
                a.infoLink = null;
              }
              if (ListMes[i].listFile && ListMes[i].listFile.length && (ListMes[i].listFile.length > 0)) {
                let listFileFirst = [];
                for (let j = 0; j < ListMes[i].listFile.length; j++) {
                  listFileFirst.push(
                    fInfoFile(
                      ListMes[i].listFile[j].messageType || "",
                      ListMes[i].listFile[j].nameFile || "",
                      ListMes[i].listFile[j].sizeFile || 0,
                      ListMes[i].listFile[j].height || 0,
                      ListMes[i].listFile[j].width || 0
                    ));
                }
                a.listFile = listFileFirst;
              }
              else {
                a.listFile = [];
              }
              a.emotionMessage = [];
              if (ListMes[i].emotion) {
                if (ListMes[i].emotion.Emotion1 && (String(ListMes[i].emotion.Emotion1).trim() != "")) {
                  a.emotionMessage.push(fEmotion(1, ListMes[i].emotion.Emotion1.split(","), "https://ht.timviec365.vn:9002/Emotion/Emotion1.png"))
                }
                if (ListMes[i].emotion.Emotion2 && (String(ListMes[i].emotion.Emotion2).trim() != "")) {
                  a.emotionMessage.push(fEmotion(2, ListMes[i].emotion.Emotion2.split(","), "https://ht.timviec365.vn:9002/Emotion/Emotion2.png"))
                }
                if (ListMes[i].emotion.Emotion3 && (String(ListMes[i].emotion.Emotion3).trim() != "")) {
                  a.emotionMessage.push(fEmotion(3, ListMes[i].emotion.Emotion3.split(","), "https://ht.timviec365.vn:9002/Emotion/Emotion3.png"))
                }
                if (ListMes[i].emotion.Emotion4 && (String(ListMes[i].emotion.Emotion4).trim() != "")) {
                  a.emotionMessage.push(fEmotion(4, ListMes[i].emotion.Emotion4.split(","), "https://ht.timviec365.vn:9002/Emotion/Emotion4.png"))
                }
                if (ListMes[i].emotion.Emotion5 && (String(ListMes[i].emotion.Emotion5).trim() != "")) {
                  a.emotionMessage.push(fEmotion(5, ListMes[i].emotion.Emotion5.split(","), "https://ht.timviec365.vn:9002/Emotion/Emotion5.png"))
                }
                if (ListMes[i].emotion.Emotion6 && (String(ListMes[i].emotion.Emotion6).trim() != "")) {
                  a.emotionMessage.push(fEmotion(6, ListMes[i].emotion.Emotion6.split(","), "https://ht.timviec365.vn:9002/Emotion/Emotion6.png"))
                }
                if (ListMes[i].emotion.Emotion7 && (String(ListMes[i].emotion.Emotion7).trim() != "")) {
                  a.emotionMessage.push(fEmotion(7, ListMes[i].emotion.Emotion7.split(","), "https://ht.timviec365.vn:9002/Emotion/Emotion7.png"))
                }
                if (ListMes[i].emotion.Emotion8 && (String(ListMes[i].emotion.Emotion8).trim() != "")) {
                  a.emotionMessage.push(fEmotion(8, ListMes[i].emotion.Emotion8.split(","), "https://ht.timviec365.vn:9002/Emotion/Emotion8.png"))
                }
              }
              else {
                a.emotion = ListMes[i].emotion || {};
                a.emotionMessage = [];
              }
              if (ListMes[i].messageType == "sendProfile") {
                if (!isNaN(ListMes[i].message)) {
                  let userData = await User.findOne({ _id: ListMes[i].message });
                  if (userData && userData.userName) {
                    let b = {};
                    b.iD365 = userData.id365;
                    b.idTimViec = userData.idTimViec;
                    b.type365 = userData.type365;
                    b.password = "";
                    b.phone = userData.phone;
                    // b.notificationPayoff = userData.notificationPayoff;
                    b.notificationPayoff = 1
                    // b.notificationCalendar = userData.notificationCalendar;
                    b.notificationCalendar = 1
                    // b.notificationReport = userData.notificationReport;
                    b.notificationReport = 1
                    // b.notificationOffer = userData.notificationOffer;
                    b.notificationOffer = 1
                    // b.notificationPersonnelChange = userData.notificationPersonnelChange;
                    b.notificationPersonnelChange = 1
                    // b.notificationRewardDiscipline = userData.notificationRewardDiscipline;
                    b.notificationRewardDiscipline = 1
                    // b.notificationNewPersonnel = userData.notificationNewPersonnel;
                    b.notificationNewPersonnel = 1
                    // b.notificationChangeProfile = userData.notificationChangeProfile;
                    b.notificationChangeProfile = 1
                    // b.notificationTransferAsset = userData.notificationTransferAsset;
                    b.notificationTransferAsset = 1
                    b.acceptMessStranger = userData.acceptMessStranger;
                    b.type_Pass = 0;
                    b.companyName = userData.companyName;
                    b.secretCode = "";
                    b.notificationMissMessage = 0;
                    b.notificationCommentFromTimViec = 0;
                    b.notificationCommentFromRaoNhanh = 0;
                    b.notificationTag = 0;
                    b.notificationSendCandidate = 0;
                    b.notificationChangeSalary = 0;
                    b.notificationAllocationRecall = 0;
                    b.notificationAcceptOffer = 0;
                    b.notificationDecilineOffer = 0;
                    b.notificationNTDPoint = 0;
                    b.notificationNTDExpiredPin = 0;
                    b.notificationNTDExpiredRecruit = 0;
                    b.fromWeb = userData.fromWeb;
                    b.notificationNTDApplying = 0;
                    b.userQr = null;
                    b.id = userData._id;
                    b.email = userData.email;
                    b.userName = userData.userName;
                    b.avatarUser = userData.avatarUser;
                    b.status = userData.status;
                    b.active = userData.active;
                    b.isOnline = userData.isOnline;
                    b.looker = userData.looker;
                    b.statusEmotion = userData.statusEmotion;
                    b.lastActive = userData.lastActive;

                    if (String(userData.avatarUser).trim != "") {
                      b.linkAvatar = `https://ht.timviec365.vn:9002/avatarUser/${userData._id}/${userData.avatarUser}`;
                    }
                    else {
                      b.linkAvatar = `https://ht.timviec365.vn:9002/avatar/${userData.userName[0]}_${getRandomInt(1, 4)}.png`
                    }
                    b.companyId = userData.companyId;

                    let status = await RequestContact.findOne({
                      $or: [
                        { userId: Number(req.body.adminId), contactId: userData._id },
                        { userId: userData._id, contactId: Number(req.body.adminId) }
                      ]
                    });
                    if (status) {
                      if (status.status == "accept") {
                        b.friendStatus = "friend";
                      }
                      else {
                        b.friendStatus = status.status;
                      }
                    }
                    else {
                      b.friendStatus = "none";
                    }
                    a.userProfile = b;
                  }
                  else {
                    a.userProfile = null;
                  }
                }

              }
              else {
                a.userProfile = null;
              }
              a.listTag = null;
              a.link = ListMes[i]?.infoLink?.linkHome;
              a.linkNotification = ListMes[i]?.infoLink?.linkHome
              a.file = a.listFile;
              a.quote = null;
              a.profile = a.userProfile;
              a.deleteTime = ListMes[i].deleteTime;
              a.deleteType = ListMes[i].deleteType;
              a.deleteDate = String('0001-01-01T00:00:00.000+00:00');
              a.infoSupport = ListMes[i].infoSupport;
              a.liveChat = ListMes[i].liveChat;
              a.isClicked = 0;
              if (ListMes[i].notiClicked.includes(Number(req.body.adminId))) {
                a.isClicked = 1;
              }
              if (ListMessFavour && ListMessFavour.includes(ListMes[i]._id)) {
                a.IsFavorite = 1;
              }
              else {
                a.IsFavorite = 0;
              }
              if (ListMes[i].infoSupport) {
                if (ListMes[i].infoSupport.status) {
                  if (ListMes[i].infoSupport.status == 1) {
                    let a = "k add"
                  }
                  else {
                    ListMessFinal.push(a)
                  }
                }
                else {
                  ListMessFinal.push(a)
                }
              }
              else {
                ListMessFinal.push(a)
              }

              if (ListMes[i].messageType == "OfferReceive") {
                if (ListMes[i + 1]) {
                  a.linkNotification = ListMes[i + 1].message || "";
                  a.infoLink = fInfoLink(ListMes[i + 1]._id, ListMes[i + 1].infoLink.title, ListMes[i + 1].infoLink.description, ListMes[i + 1].infoLink.linkHome, ListMes[i + 1].infoLink.image, ListMes[i + 1].infoLink.isNotification);
                }
              }
            }
          }
          res.json({
            data: {
              result: true,
              messsage: "Lấy danh sách tin nhắn thành công",
              countMessage: ListMessFinal.length,
              message_info: null,
              listMessages: ListMessFinal
            },
            error: null
          })
        }
        else {
          res.json({
            data: {
              result: true,
              messsage: "Lấy danh sách tin nhắn thành công",
              countMessage: 0,
              message_info: null,
              listMessages: []
            },
            error: null
          })
        }
      }
    }
    else {
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  }
  catch (e) {
    console.log(e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

export const OriginalMessage = async (req, res) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status) {
        console.log("Token hop le, OriginalMessage")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body && req.body.conversationId && req.body.messageId) {
      let findconv = await Conversation.findOne({ _id: req.body.conversationId }, { messageList: 1 }).lean()
      const idxMes = findconv.messageList.findIndex(
        (e) => e._id === req.body.messageId
      );
      console.log(idxMes)

      let conversation = await Conversation.aggregate([
        {
          $match:
            { _id: Number(req.body.conversationId) },
        },
        {
          $project: {
            messageList: {
              $slice: [  // để giới hạn kết quả trả về 
                {
                  $filter: {
                    input: "$messageList",
                    as: "messagelist",
                    cond: {
                      $ne: ["$$messagelist._id", ""]
                    },
                  }
                },
                idxMes - 5, 11
              ]
            }
          }
        }
      ]);
      if (conversation) {
        if (conversation.length > 0) {
          let ListMessFavour = [];
          if (req.body.adminId && (!isNaN(req.body.adminId))) {
            if (conversation[0].memberList && conversation[0].memberList.length && (conversation[0].memberList.length > 0) && (conversation[0].memberList.findIndex((e) => e.memberId == Number(req.body.adminId)) != -1)) {
              let memberInfor = conversation[0].memberList.find((e) => e.memberId == Number(req.body.adminId));
              if (memberInfor && memberInfor.memberId) {
                ListMessFavour = memberInfor.favoriteMessage || [];
              }
            }
          }

          let ListMessFinal = [];
          let ListMes = conversation[0].messageList;
          for (let i = 0; i < ListMes.length; i++) {
            if (ListMes[i]._id && ListMes[i].senderId && ListMes[i].messageType) {
              let a = {};
              a.messageID = ListMes[i]._id;
              a.conversationID = Number(req.body.conversationId);
              a.displayMessage = ListMes[i].displayMessage || 0;
              a.senderID = ListMes[i].senderId;
              a.messageType = ListMes[i].messageType;
              a.message = ListMes[i].message || "";
              if (ListMes[i].quoteMessage && (ListMes[i].quoteMessage.trim() != "")) {
                let conversationTakeMessage = await Conversation.aggregate([
                  {
                    $match:
                    {
                      "messageList._id": ListMes[i].quoteMessage
                    }
                  },
                  {
                    $project: {
                      messageList: {
                        $slice: [
                          {
                            $filter: {
                              input: "$messageList",
                              as: "messagelist",
                              cond: {
                                $eq: ["$$messagelist._id", ListMes[i].quoteMessage]
                              },
                            }
                          },
                          -1
                        ]
                      }
                    }
                  }
                ])
                if (conversationTakeMessage && conversationTakeMessage.length > 0 && conversationTakeMessage[0].messageList && conversationTakeMessage[0].messageList.length && (conversationTakeMessage[0].messageList.length > 0)) {
                  let message = conversationTakeMessage[0].messageList[0];
                  let senderData = await User.findOne({ _id: message.senderId }, { userName: 1 }).lean()
                  if (senderData && senderData.userName && message._id && message.senderId && message.createAt) {
                    a.quoteMessage = fMessageQuote(message._id, senderData.userName, message.senderId, message.messageType || "text", message.message, message.createAt)
                  }
                  else {
                    a.quoteMessage = null;
                  }
                }
                else {
                  a.quoteMessage = fMessageQuote(ListMes[i].quoteMessage, "", -1, "text", "", `${JSON.parse(JSON.stringify(new Date(ListMes[i].createAt.setHours(ListMes[i].createAt.getHours() + 7)))).replace("Z", "")}+07:00`)
                }
              }
              else {
                a.quoteMessage = null;
              }
              a.messageQuote = ListMes[i].messageQuote || "";
              a.createAt = `${JSON.parse(JSON.stringify(new Date(ListMes[i].createAt.setHours(ListMes[i].createAt.getHours() + 7)))).replace("Z", "")}+07:00`;
              a.isEdited = ListMes[i].isEdited || 0;
              if (ListMes[i].infoLink) {
                a.infoLink = fInfoLink(ListMes[i]._id, ListMes[i].infoLink.title, ListMes[i].infoLink.description, ListMes[i].infoLink.linkHome, ListMes[i].infoLink.image, ListMes[i].infoLink.isNotification);
              }
              else {
                a.infoLink = null;
              }
              if (ListMes[i].listFile && ListMes[i].listFile.length && (ListMes[i].listFile.length > 0)) {
                let listFileFirst = [];
                for (let j = 0; j < ListMes[i].listFile.length; j++) {
                  listFileFirst.push(
                    fInfoFile(
                      ListMes[i].listFile[j].messageType || "",
                      ListMes[i].listFile[j].nameFile || "",
                      ListMes[i].listFile[j].sizeFile || 0,
                      ListMes[i].listFile[j].height || 0,
                      ListMes[i].listFile[j].width || 0
                    ));
                }
                a.listFile = listFileFirst;
              }
              else {
                a.listFile = [];
              }
              a.emotionMessage = [];
              if (ListMes[i].emotion) {
                if (ListMes[i].emotion.Emotion1 && (String(ListMes[i].emotion.Emotion1).trim() != "")) {
                  a.emotionMessage.push(fEmotion(1, ListMes[i].emotion.Emotion1.split(","), "https://ht.timviec365.vn:9002/Emotion/Emotion1.png"))
                }
                if (ListMes[i].emotion.Emotion2 && (String(ListMes[i].emotion.Emotion2).trim() != "")) {
                  a.emotionMessage.push(fEmotion(2, ListMes[i].emotion.Emotion2.split(","), "https://ht.timviec365.vn:9002/Emotion/Emotion2.png"))
                }
                if (ListMes[i].emotion.Emotion3 && (String(ListMes[i].emotion.Emotion3).trim() != "")) {
                  a.emotionMessage.push(fEmotion(3, ListMes[i].emotion.Emotion3.split(","), "https://ht.timviec365.vn:9002/Emotion/Emotion3.png"))
                }
                if (ListMes[i].emotion.Emotion4 && (String(ListMes[i].emotion.Emotion4).trim() != "")) {
                  a.emotionMessage.push(fEmotion(4, ListMes[i].emotion.Emotion4.split(","), "https://ht.timviec365.vn:9002/Emotion/Emotion4.png"))
                }
                if (ListMes[i].emotion.Emotion5 && (String(ListMes[i].emotion.Emotion5).trim() != "")) {
                  a.emotionMessage.push(fEmotion(5, ListMes[i].emotion.Emotion5.split(","), "https://ht.timviec365.vn:9002/Emotion/Emotion5.png"))
                }
                if (ListMes[i].emotion.Emotion6 && (String(ListMes[i].emotion.Emotion6).trim() != "")) {
                  a.emotionMessage.push(fEmotion(6, ListMes[i].emotion.Emotion6.split(","), "https://ht.timviec365.vn:9002/Emotion/Emotion6.png"))
                }
                if (ListMes[i].emotion.Emotion7 && (String(ListMes[i].emotion.Emotion7).trim() != "")) {
                  a.emotionMessage.push(fEmotion(7, ListMes[i].emotion.Emotion7.split(","), "https://ht.timviec365.vn:9002/Emotion/Emotion7.png"))
                }
                if (ListMes[i].emotion.Emotion8 && (String(ListMes[i].emotion.Emotion8).trim() != "")) {
                  a.emotionMessage.push(fEmotion(8, ListMes[i].emotion.Emotion8.split(","), "https://ht.timviec365.vn:9002/Emotion/Emotion8.png"))
                }
              }
              else {
                a.emotion = ListMes[i].emotion || {};
                a.emotionMessage = [];
              }
              if (ListMes[i].messageType == "sendProfile") {
                if (!isNaN(ListMes[i].message)) {
                  let userData = await User.findOne({ _id: ListMes[i].message }).lean();
                  if (userData && userData.userName) {
                    let b = {};
                    b.iD365 = userData.id365;
                    b.idTimViec = userData.idTimViec;
                    b.type365 = userData.type365;
                    b.password = "";
                    b.phone = userData.phone;
                    // b.notificationPayoff = userData.notificationPayoff;
                    b.notificationPayoff = 1
                    // b.notificationCalendar = userData.notificationCalendar;
                    b.notificationCalendar = 1
                    // b.notificationReport = userData.notificationReport;
                    b.notificationReport = 1
                    // b.notificationOffer = userData.notificationOffer;
                    b.notificationOffer = 1
                    // b.notificationPersonnelChange = userData.notificationPersonnelChange;
                    b.notificationPersonnelChange = 1
                    // b.notificationRewardDiscipline = userData.notificationRewardDiscipline;
                    b.notificationRewardDiscipline = 1
                    // b.notificationNewPersonnel = userData.notificationNewPersonnel;
                    b.notificationNewPersonnel = 1
                    // b.notificationChangeProfile = userData.notificationChangeProfile;
                    b.notificationChangeProfile = 1
                    // b.notificationTransferAsset = userData.notificationTransferAsset;
                    b.notificationTransferAsset = 1
                    b.acceptMessStranger = userData.acceptMessStranger;
                    b.type_Pass = 0;
                    b.companyName = userData.companyName;
                    b.secretCode = "";
                    b.notificationMissMessage = 0;
                    b.notificationCommentFromTimViec = 0;
                    b.notificationCommentFromRaoNhanh = 0;
                    b.notificationTag = 0;
                    b.notificationSendCandidate = 0;
                    b.notificationChangeSalary = 0;
                    b.notificationAllocationRecall = 0;
                    b.notificationAcceptOffer = 0;
                    b.notificationDecilineOffer = 0;
                    b.notificationNTDPoint = 0;
                    b.notificationNTDExpiredPin = 0;
                    b.notificationNTDExpiredRecruit = 0;
                    b.fromWeb = userData.fromWeb;
                    b.notificationNTDApplying = 0;
                    b.userQr = null;
                    b.id = userData._id;
                    b.email = userData.email;
                    b.userName = userData.userName;
                    b.avatarUser = userData.avatarUser;
                    b.status = userData.status;
                    b.active = userData.active;
                    b.isOnline = userData.isOnline;
                    b.looker = userData.looker;
                    b.statusEmotion = userData.statusEmotion;
                    b.lastActive = userData.lastActive;

                    if (String(userData.avatarUser).trim != "") {
                      b.linkAvatar = `https://ht.timviec365.vn:9002/avatarUser/${userData._id}/${userData.avatarUser}`;
                    }
                    else {
                      b.linkAvatar = `https://ht.timviec365.vn:9002/avatar/${userData.userName[0]}_${getRandomInt(1, 4)}.png`
                    }
                    b.companyId = userData.companyId;

                    let status = await RequestContact.findOne({
                      $or: [
                        { userId: Number(req.body.adminId), contactId: userData._id },
                        { userId: userData._id, contactId: Number(req.body.adminId) }
                      ]
                    }).lean();
                    if (status) {
                      if (status.status == "accept") {
                        b.friendStatus = "friend";
                      }
                      else {
                        b.friendStatus = status.status;
                      }
                    }
                    else {
                      b.friendStatus = "none";
                    }
                    a.userProfile = b;
                  }
                  else {
                    a.userProfile = null;
                  }
                }

              }
              else {
                a.userProfile = null;
              }
              a.listTag = null;
              a.link = null;
              a.file = a.listFile;
              a.quote = null;
              a.profile = a.userProfile;
              a.deleteTime = ListMes[i].deleteTime;
              a.deleteType = ListMes[i].deleteType;
              a.deleteDate = String('0001-01-01T00:00:00.000+00:00');
              a.infoSupport = ListMes[i].infoSupport;
              a.liveChat = ListMes[i].liveChat;
              a.linkNotification = null;
              a.isClicked = 0;
              if (ListMes[i].notiClicked.includes(Number(req.body.adminId))) {
                a.isClicked = 1;
              }
              if (ListMessFavour && ListMessFavour.includes(ListMes[i]._id)) {
                a.IsFavorite = 1;
              }
              else {
                a.IsFavorite = 0;
              }
              if (ListMes[i].infoSupport) {
                if (ListMes[i].infoSupport.status) {
                  if (ListMes[i].infoSupport.status == 1) {
                    let a = "k add"
                  }
                  else {
                    ListMessFinal.push(a)
                  }
                }
                else {
                  ListMessFinal.push(a)
                }
              }
              else {
                ListMessFinal.push(a)
              }

              if (ListMes[i].messageType == "OfferReceive") {
                if (ListMes[i + 1]) {
                  a.linkNotification = ListMes[i + 1].message || "";
                  a.infoLink = fInfoLink(ListMes[i + 1]._id, ListMes[i + 1].infoLink.title, ListMes[i + 1].infoLink.description, ListMes[i + 1].infoLink.linkHome, ListMes[i + 1].infoLink.image, ListMes[i + 1].infoLink.isNotification);
                }
              }
            }
          }
          res.json({
            data: {
              result: true,
              messsage: "Lấy danh sách tin nhắn thành công",
              idxMes: idxMes,
              countMessage: ListMessFinal.length,
              message_info: null,
              listMessages: ListMessFinal
            },
            error: null
          })
        }
        else {
          res.json({
            data: {
              result: true,
              messsage: "Lấy danh sách tin nhắn thành công",
              idxMes: idxMes,
              countMessage: 0,
              message_info: null,
              listMessages: []
            },
            error: null
          })
        }
      }
    } else res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
  }
  catch (err) {
    console.log(err);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
};

export const SetClicked = async (req, res) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.UserId)) {
        console.log("Token hop le, SetClicked")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body.UserId && req.body.ConversationId && req.body.MessageId) {
      const userId = Number(req.body.UserId)
      const conversationId = Number(req.body.ConversationId)
      const messageId = req.body.MessageId

      const result = await Conversation.findOneAndUpdate({ _id: conversationId, 'messageList._id': messageId }, { $push: { 'messageList.$.notiClicked': userId } })
      if (result) {
        res.json({
          data: {
            result: true,
            message: "Click thành công",
          },
          error: null
        })
      }
      else {
        res.status(200).json(createError(200, "Click thất bại"))
      }
    }
    else {
      res.status(200).json(createError(200, "Thiếu thông tin truyền lên"))
    }
  } catch (err) {
    console.log(err)
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"))
  }
}

export const SetTimeMissLiveChat = async (req, res) => {
  try {
    const time = req.body.time
    fs.writeFileSync('utils/TimeMissLiveChat.txt', time)
    socket.emit('TimeMissLiveChat', time)
    res.json({
      data: {
        result: true,
        message: "Cap nhat thanh cong",
      },
      error: null
    })
  } catch (err) {
    console.log(err)
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"))
  }
}
// export const SetTimeMissLiveChat = async (req, res) => {
//   try {
//     const data = req.body
//     let str = fs.readFileSync('utils/TimeMissLiveChat.txt', 'utf8')
//     const obj = str.trim() ? JSON.parse(str) : {}
//     for (const key in data) {
//       obj[key] = isNaN(data[key]) ? data[key] : Number(data[key])
//     }
//     const value = JSON.stringify(obj)
//     fs.writeFileSync('utils/TimeMissLiveChat.txt', value)
//     socket.emit('TimeMissLiveChat', obj)
//     res.json({
//       data: {
//         result: true,
//         message: "Cap nhat thanh cong",
//       },
//       error: null
//     })
//   } catch (err) {
//     console.log(err)
//     res.status(200).json(createError(200, "Đã có lỗi xảy ra"))
//   }
// }

// export const GetTimeMissLiveChat = async (req, res) => {
//   try {
//     let str = fs.readFileSync('C:/Chat365/publish/wwwroot/TestNode/utils/TimeMissLiveChat.txt', 'utf8')
//     const obj = str.trim() ? JSON.parse(str) : {}
//     res.json({
//       data: {
//         result: true,
//         message: "Cap nhat thanh cong",
//         data: obj
//       },
//       error: null
//     })
//   } catch (err) {
//     console.log(err)
//     res.status(200).json(createError(200, "Đã có lỗi xảy ra"))
//   }
// }



export const GetTimeMissLiveChat = async (req, res) => {
  try {
    const time = fs.readFileSync('utils/TimeMissLiveChat.txt', 'utf8')
    res.json({
      data: {
        result: true,
        message: "Cap nhat thanh cong",
        time: time
      },
      error: null
    })
  } catch (err) {
    console.log(err)
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"))
  }
}


export const RecallListMessage = async (req, res) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status) {
        console.log("Token hop le, RecallListMessage")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    const listMessId = req.body.ListMessId.replace('[', '').replace(']', '').split(',')
    const conversationId = Number(req.body.ConversationID);
    const conv = await Conversation.findOne({ _id: conversationId }, { 'memberList.memberId': 1 }).lean()
    const memberList = []
    for (let i = 0; i < conv.memberList.length; i++) {
      memberList.push(conv.memberList[i].memberId)
    }
    Conversation.updateMany(
      { _id: conversationId, "messageList._id": listMessId },
      {
        $set: {
          "messageList.$[message].message": "Tin nhắn đã được thu hồi",
          "messageList.$[message].messageType": "text",
          "messageList.$[message].isEdited": 3
        }
      },
      {
        arrayFilters: [{ 'message._id': { $in: listMessId } }]
      }
    ).catch((e) => { console.log(e) })

    for (let i = 0; i < listMessId.length; i++) {
      const messageInfo = {
        ConversationID: conversationId,
        MessageID: listMessId[i],
        Message: 'Tin nhắn đã được thu hồi'
      }
      socket.emit('EditMessage', messageInfo, memberList)
    }
    const data = {
      result: true,
      message: "Thu hoi tin nhắn thành công",
    };
    return res.send({ data, error: null });
  } catch (err) {
    console.log(err)
    if (err) return res.send(createError(200, err.message));
  }
};


// export const ForwardMessages = async (req, res) => {
//   try {
//     let data = req.body.data.slice(1).slice(0, -1).replace('"{', '{').replace('}"', '}').replace('"[{', '[{').replace('}]"', '}]').replaceAll('},{', '};{').split(';')
//     // console.log("ForwardMessages",req.body.data)
//     for (let i = 0; i < data.length; i++) {
//       data[i] = JSON.parse(data[i])
//       await FuntionSendMessage(data[i], res)
//     }
//     return res.json({
//       data: {
//         result: true,
//         message: "Chuyển tiếp tin nhắn thành công",
//       },
//       error: null
//     })
//   } catch (err) {
//     console.log(err)
//   }
// }

export const ForwardMessages = async (req, res) => {
  try {
    let listConversationId = [];
    const SenderID = req.body.SenderID ? Number(req.body.SenderID) : null
    const IdClass = req.body.IdClass ? req.body.IdClass : null
    if (IdClass) {
      let listUserId = [];
      if (IdClass != 1) {
        let classUser = await UsersClassified.findOne({ _id: IdClass }).lean()
        listUserId = classUser.listUserId;
      }
      else {
        let classUser = await UsersClassified.findOne({ IdOwner: SenderID }).limit(50).lean()
        for (let i = 0; i < classUser.length; i++) {
          listUserId.concat(classUser[i].listUserId)
        }
      }
      let listConversationIdFist = [];
      listConversationIdFist = await Promise.all(
        listUserId.map((userId) => {
          return axios({
            method: "post",
            url: "http://43.239.223.142:9000/api/conversations/CreateNewConversation",
            data: {
              userId: Number(req.body.SenderID),
              contactId: Number(userId)
            },
            headers: { "Content-Type": "multipart/form-data" }
          });
        })
      )
      for (let i = 0; i < listConversationIdFist.length; i++) {
        if (!isNaN(listConversationIdFist[i].data.data.conversationId)) {
          listConversationId.push(Number(listConversationIdFist[i].data.data.conversationId))
        }
      }
    }
    let data = req.body.data.slice(1).slice(0, -1).replace('"{', '{').replace('}"', '}').replace('"[{', '[{').replace('}]"', '}]').replaceAll('},{', '};{').split(';')
    for (let i = 0; i < data.length; i++) {
      data[i] = JSON.parse(data[i])
      if (IdClass) {
        for (let j = 0; j < listConversationId.length; j++) {
          data[i].ConversationID = listConversationId[j]
          await FuntionSendMessage(data[i], res)
        }
      }
      else {
        await FuntionSendMessage(data[i], res)
      }
    }
    return res.json({
      data: {
        result: true,
        message: "Chuyển tiếp tin nhắn thành công",
      },
      error: null
    })
  } catch (err) {
    console.log(err)
  }
}

const FuntionSendMessage = async (data, res) => {
  try {
    if (data && data.ConversationID && (!isNaN(data.ConversationID)) && data.SenderID) {
      let ConversationID = Number(data.ConversationID);
      let SenderID = Number(data.SenderID);
      let Message = data.Message ? String(data.Message) : "";
      let Quote = data.QuoteMessage ? String(data.QuoteMessage) : "";
      let Profile = data.UserProfile ? String(data.UserProfile) : "";
      let ListTag = data.ListTag ? String(data.ListTag) : "";
      let File = data.ListFile ? data.ListFile : "";
      let ListMember = data.ListMember ? String(data.ListMember) : "";
      let IsOnline = data.IsOnline ? String(data.IsOnline) : "";
      let conversationName = data.conversationName ? String(data.conversationName) : "";
      let isGroup = (data.isGroup && (!isNaN(data.isGroup))) ? Number(data.isGroup) : 0;
      let deleteTime = (data.deleteTime && (!isNaN(data.deleteTime))) ? Number(data.deleteTime) : 0;
      let deleteType = (data.deleteType && (!isNaN(data.deleteType))) ? Number(data.deleteType) : 0;
      let liveChat = data.liveChat ? String(data.liveChat) : null;
      let infoSupport = data.InfoSupport ? String(data.InfoSupport) : null;
      if (data.MessageType && (data.ListFile || data.Message || data.QuoteMessage)) {
        let MessageType = String(data.MessageType);
        let mess = {};
        mess.MessageID = "";
        if (data.MessageID && (data.MessageID.trim() != "")) {
          mess.MessageID = data.MessageID;
        }
        else {
          mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000000 + 8}_${SenderID}`;
        }
        mess.CreateAt = `${JSON.parse(JSON.stringify(new Date(new Date().setHours(new Date().getHours() + 7)))).replace("Z", "")}+07:00`;

        mess.ConversationID = ConversationID;
        mess.SenderID = SenderID;
        mess.MessageType = MessageType;
        mess.Message = Message;
        mess.ListTag = ListTag;
        mess.DeleteTime = deleteTime;
        mess.DeleteType = deleteType;
        mess.DeleteDate = String('0001-01-01T00:00:00.000+00:00');
        mess.IsFavorite = 0;
        if (!data.QuoteMessage || (String(data.QuoteMessage).trim() == "") || (String(data.QuoteMessage) == "null")) {
          mess.QuoteMessage = MessageQuote("", "", 0, "", "", `${JSON.parse(JSON.stringify(new Date())).replace("Z", "")}6769+07:00`);
        }
        else {
          mess.QuoteMessage = data.QuoteMessage;
          mess.QuoteMessage.SenderID = Number(mess.QuoteMessage.SenderID);
        }

        if (data.ListFile && (String(data.ListFile) != "null")) {
          mess.ListFile = data.ListFile;
          for (let i = 0; i < mess.ListFile.length; i++) {
            if ((!isNaN(mess.ListFile[i].Height))) {
              mess.ListFile[i].Height = Number(mess.ListFile[i].Height);
            }
            else {
              mess.ListFile[i].Height = 10;
            }
            if ((!isNaN(mess.ListFile[i].Width))) {
              mess.ListFile[i].Width = Number(mess.ListFile[i].Width);
            }
            else {
              mess.ListFile[i].Width = 10;
            };
            if ((!isNaN(mess.ListFile[i].SizeFile))) {
              mess.ListFile[i].SizeFile = Number(mess.ListFile[i].SizeFile);
            }
            else {
              mess.ListFile[i].SizeFile = 10;
            };
          }
        }
        else {
          mess.ListFile = null;
        }


        if (MessageType === 'sendProfile') {
          let obj = await User.findOne({ _id: Number(Message) }).lean()
          mess.UserProfile = {};
          mess.UserProfile.AcceptMessStranger = Number(obj.acceptMessStranger)
          mess.UserProfile.Active = Number(obj.active)
          mess.UserProfile.AvatarUser = obj.avatarUser;
          mess.UserProfile.CompanyId = Number(obj.companyId)
          mess.UserProfile.CompanyName = obj.companyName;
          mess.UserProfile.Email = obj.email;
          // mess.UserProfile.FriendStatus = obj.friendStatus;
          // mess.UserProfile.FromWeb = obj.fromWeb;
          mess.UserProfile.ID = Number(obj._id)
          mess.UserProfile.ID365 = (!isNaN(obj.id365)) ? Number(obj.id365) : 0;
          mess.UserProfile.IDTimViec = Number(obj.idTimViec)
          mess.UserProfile.LastActive = `${JSON.parse(JSON.stringify(new Date(new Date().setHours(new Date().getHours() + 7)))).replace("Z", "")}+07:00`;
          mess.UserProfile.LinkAvatar = `${urlImgHost()}avatarUser/${obj._id}/${obj.avatarUser}`;
          // mess.UserProfile.Looker = Number(obj.looklooker)
          mess.UserProfile.NotificationAcceptOffer = 1;
          mess.UserProfile.NotificationAllocationRecall = 1;
          mess.UserProfile.NotificationCalendar = 1;
          mess.UserProfile.NotificationChangeProfile = 1;
          mess.UserProfile.NotificationChangeSalary = 1;
          mess.UserProfile.NotificationCommentFromRaoNhanh = 1;
          mess.UserProfile.NotificationCommentFromTimViec = 1;
          mess.UserProfile.NotificationDecilineOffer = 1;
          mess.UserProfile.NotificationMissMessage = 1;
          mess.UserProfile.NotificationNTDApplying = 0;
          mess.UserProfile.NotificationNTDExpiredPin = 1;
          mess.UserProfile.NotificationNTDExpiredRecruit = 1;
          mess.UserProfile.NotificationNTDPoint = 1;
          mess.UserProfile.NotificationNewPersonnel = 1;
          mess.UserProfile.NotificationOffer = 1;
          mess.UserProfile.NotificationPayoff = 1;
          mess.UserProfile.NotificationPersonnelChange = 1;
          mess.UserProfile.NotificationReport = 1;
          mess.UserProfile.NotificationRewardDiscipline = 1;
          mess.UserProfile.NotificationSendCandidate = 1;
          mess.UserProfile.NotificationTag = 1;
          mess.UserProfile.NotificationTransferAsset = 1;
          mess.UserProfile.Password = obj.password;
          mess.UserProfile.Phone = obj.phone;
          mess.UserProfile.Status = obj.status;
          // mess.UserProfile.StatusEmotion = Number(obj.statusEmotion);
          mess.UserProfile.Type365 = Number(obj.type365);
          // mess.UserProfile.Type_Pass = Number(obj.type_Pass);
          mess.UserProfile.UserName = obj.userName;
          mess.UserProfile.isOnline = Number(obj.isOnline);
          mess.UserProfile.secretCode = obj.secretCode;
          mess.UserProfile.userQr = obj.userQr;
        }
        else {
          mess.UserProfile = {};
          mess.UserProfile.AcceptMessStranger = 0
          mess.UserProfile.Active = 0
          mess.UserProfile.AvatarUser = null;
          mess.UserProfile.CompanyId = 0
          mess.UserProfile.CompanyName = null;
          mess.UserProfile.Email = null;
          mess.UserProfile.FriendStatus = null;
          mess.UserProfile.FromWeb = null;
          mess.UserProfile.ID = 0
          mess.UserProfile.ID365 = 0
          mess.UserProfile.IDTimViec = 0
          mess.UserProfile.LastActive = `${JSON.parse(JSON.stringify(new Date(new Date().setHours(new Date().getHours() + 7)))).replace("Z", "")}+07:00`;
          mess.UserProfile.LinkAvatar = null;
          mess.UserProfile.Looker = 0
          mess.UserProfile.NotificationAcceptOffer = 0;
          mess.UserProfile.NotificationAllocationRecall = 0;
          mess.UserProfile.NotificationCalendar = 0;
          mess.UserProfile.NotificationChangeProfile = 0;
          mess.UserProfile.NotificationChangeSalary = 0;
          mess.UserProfile.NotificationCommentFromRaoNhanh = 0;
          mess.UserProfile.NotificationCommentFromTimViec = 0;
          mess.UserProfile.NotificationDecilineOffer = 0;
          mess.UserProfile.NotificationMissMessage = 0;
          mess.UserProfile.NotificationNTDApplying = 0;
          mess.UserProfile.NotificationNTDExpiredPin = 0;
          mess.UserProfile.NotificationNTDExpiredRecruit = 0;
          mess.UserProfile.NotificationNTDPoint = 0;
          mess.UserProfile.NotificationNewPersonnel = 0;
          mess.UserProfile.NotificationOffer = 0;
          mess.UserProfile.NotificationPayoff = 0;
          mess.UserProfile.NotificationPersonnelChange = 0;
          mess.UserProfile.NotificationReport = 0;
          mess.UserProfile.NotificationRewardDiscipline = 0;
          mess.UserProfile.NotificationSendCandidate = 0;
          mess.UserProfile.NotificationTag = 0;
          mess.UserProfile.NotificationTransferAsset = 0;
          mess.UserProfile.Password = null;
          mess.UserProfile.Phone = null;
          mess.UserProfile.Status = null;
          mess.UserProfile.StatusEmotion = 0;
          mess.UserProfile.Type365 = 0;
          mess.UserProfile.Type_Pass = 0;
          mess.UserProfile.UserName = null;
          mess.UserProfile.isOnline = 0;
          mess.UserProfile.secretCode = null;
          mess.UserProfile.userQr = null;
        }

        if (mess.DeleteType == 0 && mess.DeleteTime > 0) {
          mess.DeleteDate = (new Date()).setSeconds(new Date().getSeconds() + Number(deleteTime));
        }

        // lấy id kèm mảng trạng thái online 
        let listMember = [];
        let isOnline = [];
        Conversation.findOne({ _id: ConversationID }, { "memberList.memberId": 1, "memberList.liveChat": 1, typeGroup: 1 })
          .then(async (conversation) => {

            // take data user 
            for (let i = 0; i < conversation.memberList.length; i++) {
              listMember.push(conversation.memberList[i].memberId);
              isOnline.push(1);
            }


            // live chat
            mess.liveChat = null;
            let typeSendLiveChat = "";
            if (liveChat) {
              mess.liveChat = null;
            }
            else if (conversation && conversation.memberList && (conversation.memberList.length > 0)) {
              let liveChatDB = conversation.memberList.find(e => e.memberId == SenderID);
              if (liveChatDB) {
                liveChatDB = liveChatDB.liveChat;
              }
              if (liveChatDB && liveChatDB.clientId) {  // người gửi là client 
                typeSendLiveChat = "ClientSend";
                listMember = listMember.filter(e => e != SenderID); // id tài khoản tư vấn viên 
                liveChatDB.clientName = liveChatDB.clientName ? liveChatDB.clientName : liveChatDB.clientId;
                mess.liveChat = InfoLiveChat(liveChatDB.clientId, liveChatDB.clientName,
                  `https://mess.timviec365.vn/avatar/${String(liveChatDB.clientName).trim()[0].toUpperCase()}_${getRandomInt(1, 4)}.png`,
                  liveChatDB.fromWeb
                );
              }
              else {  // người gửi là tư vấn viên 
                if (conversation.typeGroup == "liveChat") {
                  liveChatDB = conversation.memberList.find(e => e.memberId != SenderID);
                  liveChatDB = liveChatDB.liveChat;
                  if (liveChatDB) {
                    typeSendLiveChat = "HostSend";
                    listMember = listMember.filter(e => e == SenderID);// id tài khoản tư vấn viên 
                    liveChatDB.clientName = liveChatDB.clientName ? liveChatDB.clientName : liveChatDB.clientId;
                    mess.liveChat = InfoLiveChat(liveChatDB.clientId, liveChatDB.clientName,
                      `https://mess.timviec365.vn/avatar/${String(liveChatDB.clientName.trim()[0]).toUpperCase()}_${getRandomInt(1, 4)}.png`,
                      liveChatDB.fromWeb
                    );
                  }
                }
              }
            }

            // to main conversation group 
            let infoSupportDB = null; // tạo infor support để insert vào base 
            let LiveChatInfor = null;
            if (infoSupport) {
              let InfoSupport = infoSupport;

              if (InfoSupport.Title == "Tin nhắn nhỡ") {
                mess.InfoSupport = {};
                mess.InfoSupport.HaveConversation = 0;
                mess.InfoSupport.Message = `${InfoSupport.Message}${infoSupport.split(",")[2]}${infoSupport.split(",")[3]}${infoSupport.split(",")[4].replace('"', '').replace('}', '')}`;
                mess.InfoSupport.Status = Number(InfoSupport.Status);
                mess.InfoSupport.SupportId = mess.MessageID;
                mess.InfoSupport.Time = "0001-01-01T00:00:00";
                mess.InfoSupport.Title = InfoSupport.Title;
                mess.InfoSupport.UserId = Number(InfoSupport.UserId);
                mess.InfoSupport.userName = null;

                infoSupportDB = InfoSupportDB(mess.InfoSupport.Title, mess.InfoSupport.Message,
                  mess.InfoSupport.SupportId, mess.InfoSupport.HaveConversation,
                  mess.InfoSupport.UserId, mess.InfoSupport.Status, String('0001-01-01T00:00:00.000+00:00')
                );

                mess.LiveChat = {};
                mess.LiveChat.ClientAvatar = "https://mess.timviec365.vn/avatar/K_4.png";
                mess.LiveChat.ClientId = infoSupport.split(",")[2].split(":")[1].trim();
                mess.LiveChat.ClientName = `Khách hàng ${mess.InfoSupport.Message.split(":")[2].split(",")[0].replace('tôi cần bạn hỗ trợ!', '').trim()}`
                mess.LiveChat.FromWeb = mess.InfoSupport.Message.split(":")[2].split(",")[0].replace('tôi cần bạn hỗ trợ!', '').trim().split(".")[0];
                LiveChatInfor = LiveChatDB(mess.LiveChat.ClientId, mess.LiveChat.ClientName, mess.LiveChat.FromWeb)
                socket.emit("SendMessage", mess, [mess.LiveChat.ClientId]); // gui lai chinh no 
              }
              // crm 
              else if (InfoSupport.Status && (Number(InfoSupport.Status) == 3)) {
                mess.InfoSupport = {};
                mess.InfoSupport.HaveConversation = 0;
                mess.InfoSupport.Message = data.SmallTitile
                mess.InfoSupport.Status = 0;
                mess.InfoSupport.SupportId = mess.MessageID;
                mess.InfoSupport.Time = "0001-01-01T00:00:00";
                mess.InfoSupport.Title = InfoSupport.Title || "Hỗ trợ";
                mess.InfoSupport.UserId = 0;
                mess.InfoSupport.userName = null;

                infoSupportDB = InfoSupportDB(mess.InfoSupport.Title, mess.InfoSupport.Message,
                  mess.InfoSupport.SupportId, mess.InfoSupport.HaveConversation,
                  mess.InfoSupport.UserId, mess.InfoSupport.Status || 0, String('0001-01-01T00:00:00.000+00:00')
                );
                mess.LiveChat = {};
                mess.LiveChat.ClientAvatar = "https://mess.timviec365.vn/avatar/K_4.png";
                mess.LiveChat.ClientId = InfoSupport.ClientId;
                mess.LiveChat.ClientName = InfoSupport.ClientName;
                mess.LiveChat.FromWeb = InfoSupport.FromWeb;
                LiveChatInfor = LiveChatDB(mess.LiveChat.ClientId, mess.LiveChat.ClientName, mess.LiveChat.FromWeb)
                socket.emit("SendMessage", mess, [mess.LiveChat.ClientId]); // gui lai chinh no 
              }
              else {
                mess.InfoSupport = {};
                mess.InfoSupport.HaveConversation = 0;
                mess.InfoSupport.Message = `${InfoSupport.Message}${infoSupport.split(",")[2]}${infoSupport.split(",")[3]}${infoSupport.split(",")[4].replace('"', '').replace('}', '')}`;
                mess.InfoSupport.Status = 0;
                mess.InfoSupport.SupportId = mess.MessageID;
                mess.InfoSupport.Time = "0001-01-01T00:00:00";
                mess.InfoSupport.Title = InfoSupport.Title || "Hỗ trợ";
                mess.InfoSupport.UserId = 0;
                mess.InfoSupport.userName = null;

                infoSupportDB = InfoSupportDB(mess.InfoSupport.Title, mess.InfoSupport.Message,
                  mess.InfoSupport.SupportId, mess.InfoSupport.HaveConversation,
                  mess.InfoSupport.UserId, mess.InfoSupport.Status || 0, String('0001-01-01T00:00:00.000+00:00')
                );

                mess.LiveChat = {};
                mess.LiveChat.ClientAvatar = "https://mess.timviec365.vn/avatar/K_4.png";
                mess.LiveChat.ClientId = infoSupport.split(",")[2].split(":")[1].trim();
                mess.LiveChat.ClientName = `Khách hàng ${mess.InfoSupport.Message.split(":")[2].split(",")[0].replace('tôi cần bạn hỗ trợ!', '').trim()}`
                mess.LiveChat.FromWeb = mess.InfoSupport.Message.split(":")[2].split(",")[0].replace('tôi cần bạn hỗ trợ!', '').trim().split(".")[0];
                LiveChatInfor = LiveChatDB(mess.LiveChat.ClientId, mess.LiveChat.ClientName, mess.LiveChat.FromWeb)
                socket.emit("SendMessage", mess, [mess.LiveChat.ClientId]); // gui lai chinh no 
              }

            };

            // to single conv live chat
            if (mess.liveChat != null) {
              // config cho giống live chat render 
              mess.EmotionMessage = null;
              mess.File = mess.ListFile;
              mess.InfoLink = null;
              mess.Profile = null;
              mess.InfoSupport = null;
              mess.IsClicked = 0;
              mess.IsEdited = 0;
              mess.Link = null;
              mess.LinkNotification = null;
              mess.Quote = mess.QuoteMessage;
              mess.SenderName = "Hỗ trợ khách hàng";
              mess.LiveChat = mess.liveChat;
              let listDevices = [];
              listDevices.push(mess.liveChat.ClientId);
              let currentWeb = mess.liveChat.FromWeb;
              if (typeSendLiveChat == "HostSend") {
                mess.LiveChat = null;
                mess.liveChat = null;
              }
              // sendNotificationToTimViec(mess, conversationName, mess.ConversationID, listMember, isOnline, isGroup, true);
              if (MessageType != "link") {
                socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);

                if (MessageType == "sendFile" || MessageType == "sendPhoto") {
                  let findSend = [];
                  for (let i = 0; i < mess.ListFile.length; i++) {
                    findSend.push(FileSendDB((!isNaN(mess.ListFile[i].SizeFile)) ? Number(mess.ListFile[i].SizeFile) : 100, String(mess.ListFile[i].FullName), Number(mess.ListFile[i].Height), Number(mess.ListFile[i].Width)))
                  };
                  Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                    if (counter && counter.length > 0 && counter[0].countID) {
                      const filter = { name: "MessageId" };
                      const update = { countID: counter[0].countID + 1 };
                      await Counter.updateOne(filter, update);
                      Conversation.updateOne({ _id: ConversationID }, { $set: { timeLastMessage: new Date(mess.CreateAt) } }).catch((e) => (console.log(e)));
                      if (typeSendLiveChat == "ClientSend") {
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType,
                              mess.Message, mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0), findSend, EmotionMessageDBDefault(),
                              mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB,
                              LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                              [])
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                        });
                      }
                      else {
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType,
                              mess.Message, mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0), findSend, EmotionMessageDBDefault(),
                              mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                        });
                      }
                    }
                  }).catch(function (err) {
                    console.log(err);
                  });
                }
                else if (MessageType == "map") {
                  let z = mess.Message.split(",");
                  let link = `https://www.google.com/maps/search/${z[0].trim()},${z[1].trim()}/${z[0].trim()},${z[1].trim()},10z?hl=vi`;
                  mess.InfoLink = {};
                  mess.InfoLink.HaveImage = "False";
                  let index = link.indexOf("/", 9);
                  if (index != -1) {
                    mess.InfoLink.LinkHome = link.slice(0, index);
                  }
                  else {
                    mess.InfoLink.LinkHome = link;
                  }
                  axios.get(link).then((doc) => {
                    if (doc && doc.data) {
                      mess.InfoLink.Title = String(doc.data).split("<title>")[1].split("</title>")[0].trim() || "Không tìm thấy thông tin website";
                      mess.InfoLink.Description = null;
                      let Image = String(doc.data).split(`property="og:image`)[0].replace(`"`, '');
                      mess.InfoLink.Image = Image.split(`<meta content=`)[Image.split(`<meta content=`).length - 1].replace('"', ``).replace('"', ``);
                      mess.InfoLink.Image = String(mess.InfoLink.Image).replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').trim();
                      if (mess.InfoLink.Image) {
                        mess.InfoLink.HaveImage = "True";
                      }
                      mess.InfoLink.MessageID = null;
                      mess.InfoLink.TypeLink = null;

                      // gửi lại link bằng socket 
                      socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);
                      // thêm dữ liệu vào base
                      Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                        if (counter && counter.length > 0 && counter[0].countID) {
                          const filter = { name: "MessageId" };
                          const update = { countID: counter[0].countID + 1 };
                          await Counter.updateOne(filter, update);
                          if (typeSendLiveChat == "ClientSend") {
                            Conversation.updateOne({ _id: ConversationID }, {
                              $push: {
                                messageList: MessagesDB(
                                  mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                  mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                  infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                  mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB,
                                  LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                                  [])
                              },
                              $set: { timeLastMessage: new Date(mess.CreateAt) }
                            }).catch(function (err) {
                              console.log(err);
                            });
                          }
                          else {
                            Conversation.updateOne({ _id: ConversationID }, {
                              $push: {
                                messageList: MessagesDB(
                                  mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                  mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                  infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                  mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                              },
                              $set: { timeLastMessage: new Date(mess.CreateAt) }
                            }).catch(function (err) {
                              console.log(err);
                            });
                          }
                        }
                      }).catch(function (err) {
                        console.log(err);
                      });
                    }
                  }).catch((e) => {
                    console.log(e)
                  })
                }
                else {

                  Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                    if (counter && counter.length > 0 && counter[0].countID) {
                      const filter = { name: "MessageId" };
                      const update = { countID: counter[0].countID + 1 };
                      await Counter.updateOne(filter, update);
                      if (typeSendLiveChat == "ClientSend") {
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                              mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0),
                              mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB,
                              LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                              [])
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                        });
                      }
                      else {
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                              mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0),
                              mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                        });
                      }
                    }
                  }).catch(function (err) {
                    console.log(err);
                  });
                }
              }

              if ((MessageType == "link") || (MessageType == "text")) {
                if (MessageType == "link") { // gửi socket 2 lần, lưu vào base 1 tin nhắn 
                  socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);
                  mess.InfoLink = {};
                  mess.InfoLink.HaveImage = "False";
                  if (String(mess.Message)[String(mess.Message).length - 1] == "/") {
                    mess.Message = String(mess.Message).slice(0, String(mess.Message).length - 1)
                  };
                  mess.InfoLink.LinkHome = mess.Message;

                  let doc = await getLinkPreview(
                    `${mess.Message}`
                  );
                  if (doc) {
                    mess.InfoLink.Title = doc.title || "Không tìm thấy thông tin website";
                    mess.InfoLink.Description = doc.description || null;
                    mess.InfoLink.Image = (doc.images.length > 0) ? doc.images[0] : null;
                    if (mess.InfoLink.Image) {
                      mess.InfoLink.HaveImage = "True";
                    }
                    mess.InfoLink.MessageID = null;
                    mess.InfoLink.TypeLink = null;
                    mess.InfoLink.IsNotification = 0;
                  }
                  else {
                    mess.InfoLink.Title = "Không tìm thấy thông tin website";
                    mess.InfoLink.Description = null;
                    mess.InfoLink.Image = null;
                    mess.InfoLink.MessageID = null;
                    mess.InfoLink.TypeLink = null;
                    mess.InfoLink.IsNotification = 0;
                  }
                  socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);
                  Conversation.updateOne({ _id: ConversationID }, { $set: { timeLastMessage: new Date(mess.CreateAt) } }).catch((e) => (console.log(e)));
                  // insert link to base 
                  Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                    if (counter && counter.length > 0 && counter[0].countID) {
                      const filter = { name: "MessageId" };
                      const update = { countID: counter[0].countID + 1 };
                      await Counter.updateOne(filter, update);
                      if (typeSendLiveChat == "ClientSend") {
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                              mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                              infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                              mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB,
                              LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                              [])
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                        });
                      }
                      else {
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                              mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                              infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                              mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                        });
                      }
                    }
                  }).catch(function (err) {
                    console.log(err);
                  });
                  MarkUnreaderMessage(ConversationID, SenderID, listMember);
                }
                else { // text chứa link; bắn 2 lần socket và lưu 2 tin nhắn 
                  mess.InfoLink = {};
                  mess.InfoLink.HaveImage = "False";
                  let urlCheck = new RegExp("[a-zA-Z\d]+://(\w+:\w+@)?([a-zA-Z\d.-]+\.[A-Za-z]{2,4})(:\d+)?(/.*)?")
                  if (urlCheck.test(mess.Message)) {
                    let link = mess.Message.slice(mess.Message.indexOf('http'), mess.Message.length);
                    getLinkPreview(
                      `${link}`
                    ).then((doc) => {
                      if (doc) {

                        mess.InfoLink.LinkHome = doc.url;
                        mess.InfoLink.Title = doc.title || "Không tìm thấy thông tin website";
                        mess.InfoLink.Description = doc.description || null;
                        mess.InfoLink.Image = (doc.images.length > 0) ? doc.images[0] : null;
                        if (mess.InfoLink.Image) {
                          mess.InfoLink.HaveImage = "True";
                        }
                        mess.InfoLink.MessageID = null;
                        mess.InfoLink.TypeLink = null;
                        mess.InfoLink.IsNotification = 0;
                        // bắn trc 1 socket cho bên app render 
                        mess.Message = doc.url;
                        mess.MessageType = "link";
                        mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000000 + 8}_${SenderID}`;
                        socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);
                        Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                          if (counter && counter.length > 0 && counter[0].countID) {
                            const filter = { name: "MessageId" };
                            const update = { countID: counter[0].countID + 1 };
                            await Counter.updateOne(filter, update);
                            if (typeSendLiveChat == "ClientSend") {
                              Conversation.updateOne({ _id: ConversationID }, {
                                $push: {
                                  messageList: MessagesDB(
                                    mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                    mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                    infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                    mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate,
                                    infoSupportDB,
                                    LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                                    [])
                                },
                                $set: { timeLastMessage: new Date(mess.CreateAt) }
                              }).catch(function (err) {
                                console.log(err);
                              });
                            } else {
                              Conversation.updateOne({ _id: ConversationID }, {
                                $push: {
                                  messageList: MessagesDB(
                                    mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                    mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                    infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                    mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                                },
                                $set: { timeLastMessage: new Date(mess.CreateAt) }
                              }).catch(function (err) {
                                console.log(err);
                              });
                            }
                          }
                        }).catch(function (err) {
                          console.log(err);
                        });
                        MarkUnreaderMessage(ConversationID, SenderID, listMember);
                      }
                    }).catch((e) => {
                      mess.InfoLink.Title = "Không tìm thấy thông tin website";
                      mess.InfoLink.Description = null;
                      mess.InfoLink.Image = null;
                      mess.InfoLink.MessageID = null;
                      mess.InfoLink.TypeLink = null;
                      mess.InfoLink.LinkHome = link.trim();
                      mess.InfoLink.IsNotification = 0;
                      // bắn trc 1 socket cho bên app render
                      mess.Message = link.trim();
                      mess.MessageType = "link";
                      mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000000 + 8}_${SenderID}`;
                      socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);
                      Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                        if (counter && counter.length > 0 && counter[0].countID) {
                          const filter = { name: "MessageId" };
                          const update = { countID: counter[0].countID + 1 };
                          await Counter.updateOne(filter, update);
                          if (typeSendLiveChat == "ClientSend") {
                            Conversation.updateOne({ _id: ConversationID }, {
                              $push: {
                                messageList: MessagesDB(
                                  mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                  mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                  infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                  mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB,
                                  LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                                  [])
                              },
                              $set: { timeLastMessage: new Date(mess.CreateAt) }
                            }).catch(function (err) {
                              console.log(err);
                            });
                          }
                          else {
                            Conversation.updateOne({ _id: ConversationID }, {
                              $push: {
                                messageList: MessagesDB(
                                  mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                  mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                  infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                  mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                              },
                              $set: { timeLastMessage: new Date(mess.CreateAt) }
                            }).catch(function (err) {
                              console.log(err);
                            });
                          }
                        }
                      }).catch(function (err) {
                        console.log(err);
                      });
                      MarkUnreaderMessage(ConversationID, SenderID, listMember);
                    });
                  }
                }
              }
              // đánh dấu tin nhắn chưa đọc 
              MarkUnreaderMessage(ConversationID, SenderID, listMember);
            }
            else {

              sendNotificationToTimViec(mess, conversationName, mess.ConversationID, listMember, isOnline, isGroup, true);
              // SendMailMissMessage(ConversationID, mess);
              if (MessageType != "link") {

                if (data.from && (data.from == "Chat Winform")) {
                  if (MessageType == "sendFile" || MessageType == "sendPhoto") {
                    console.log("k ban socket vi api upload file da co")
                  }
                  else {
                    socket.emit("SendMessage", mess, listMember);
                  }
                }
                else {
                  socket.emit("SendMessage", mess, listMember);
                }

                if (MessageType == "sendFile" || MessageType == "sendPhoto" || MessageType == "sendVoice") {
                  let findSend = [];
                  for (let i = 0; i < mess.ListFile.length; i++) {
                    findSend.push(FileSendDB((!isNaN(mess.ListFile[i].SizeFile)) ? Number(mess.ListFile[i].SizeFile) : 100, String(mess.ListFile[i].FullName), Number(mess.ListFile[i].Height), Number(mess.ListFile[i].Width)))
                  };
                  Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                    if (counter && counter.length > 0 && counter[0].countID) {
                      const filter = { name: "MessageId" };
                      const update = { countID: counter[0].countID + 1 };
                      await Counter.updateOne(filter, update);
                      Conversation.updateOne({ _id: ConversationID }, {
                        $push: {
                          messageList: MessagesDB(
                            mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType,
                            mess.Message, mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0), findSend, EmotionMessageDBDefault(),
                            mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [])
                        },
                        $set: { timeLastMessage: new Date(mess.CreateAt) }
                      }).catch(function (err) {
                        console.log(err);
                      });
                    }
                  }).catch(function (err) {
                    console.log(err);
                  });
                }
                else if (MessageType == "map") {
                  let z = mess.Message.split(",");
                  let link = `https://www.google.com/maps/search/${z[0].trim()},${z[1].trim()}/${z[0].trim()},${z[1].trim()},10z?hl=vi`;
                  mess.InfoLink = {};
                  mess.InfoLink.HaveImage = "False";
                  let index = link.indexOf("/", 9);
                  if (index != -1) {
                    mess.InfoLink.LinkHome = link.slice(0, index);
                  }
                  else {
                    mess.InfoLink.LinkHome = link;
                  }
                  axios.get(link).then((doc) => {
                    if (doc && doc.data) {
                      mess.InfoLink.Title = String(doc.data).split("<title>")[1].split("</title>")[0].trim() || "Không tìm thấy thông tin website";
                      mess.InfoLink.Description = null;
                      let Image = String(doc.data).split(`property="og:image`)[0].replace(`"`, '');
                      mess.InfoLink.Image = Image.split(`<meta content=`)[Image.split(`<meta content=`).length - 1].replace('"', ``).replace('"', ``);
                      mess.InfoLink.Image = String(mess.InfoLink.Image).replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').trim();
                      if (mess.InfoLink.Image) {
                        mess.InfoLink.HaveImage = "True";
                      }
                      mess.InfoLink.MessageID = null;
                      mess.InfoLink.TypeLink = null;
                      socket.emit("SendMessage", mess, listMember);
                      // thêm dữ liệu vào base
                      Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                        if (counter && counter.length > 0 && counter[0].countID) {
                          const filter = { name: "MessageId" };
                          const update = { countID: counter[0].countID + 1 };
                          await Counter.updateOne(filter, update);
                          Conversation.updateOne({ _id: ConversationID }, {
                            $push: {
                              messageList: MessagesDB(
                                mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [])
                            },
                            $set: { timeLastMessage: new Date(mess.CreateAt) }
                          }).catch(function (err) {
                            console.log(err);
                          });
                        }
                      }).catch(function (err) {
                        console.log(err);
                      });
                    }
                  }).catch((e) => {
                    console.log(e)
                  })
                }
                else {
                  Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                    if (counter && counter.length > 0 && counter[0].countID) {
                      const filter = { name: "MessageId" };
                      const update = { countID: counter[0].countID + 1 };
                      await Counter.updateOne(filter, update);

                      Conversation.updateOne({ _id: ConversationID }, {
                        $push: {
                          messageList: MessagesDB(
                            mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, Message,
                            mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0),
                            mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [])
                        },
                        $set: { timeLastMessage: new Date(mess.CreateAt) }
                      }).catch(function (err) {
                        console.log(err);
                      });
                    }
                  }).catch(function (err) {
                    console.log(err);
                  });
                }
              }

              if ((MessageType == "link") || (MessageType == "text")) {
                if (MessageType == "link") { // gửi socket 2 lần, lưu vào base 1 tin nhắn 
                  socket.emit("SendMessage", mess, listMember);
                  mess.InfoLink = {};
                  mess.InfoLink.HaveImage = "False";
                  if (String(mess.Message)[String(mess.Message).length - 1] == "/") {
                    mess.Message = String(mess.Message).slice(0, String(mess.Message).length - 1)
                  };
                  mess.InfoLink.LinkHome = mess.Message;

                  let doc = await getLinkPreview(
                    `${mess.Message}`
                  );
                  if (doc) {
                    mess.InfoLink.Title = doc.title || "Không tìm thấy thông tin website";
                    mess.InfoLink.Description = doc.description || null;
                    mess.InfoLink.Image = (doc.images.length > 0) ? doc.images[0] : null;
                    if (mess.InfoLink.Image) {
                      mess.InfoLink.HaveImage = "True";
                    }
                    mess.InfoLink.MessageID = null;
                    mess.InfoLink.TypeLink = null;
                    mess.InfoLink.IsNotification = 0;
                  }
                  else {
                    mess.InfoLink.Title = "Không tìm thấy thông tin website";
                    mess.InfoLink.Description = null;
                    mess.InfoLink.Image = null;
                    mess.InfoLink.MessageID = null;
                    mess.InfoLink.TypeLink = null;
                    mess.InfoLink.IsNotification = 0;
                  }
                  socket.emit("SendMessage", mess, listMember);
                  // insert link to base 
                  Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                    if (counter && counter.length > 0 && counter[0].countID) {
                      const filter = { name: "MessageId" };
                      const update = { countID: counter[0].countID + 1 };
                      await Counter.updateOne(filter, update);

                      Conversation.updateOne({ _id: ConversationID }, {
                        $push: {
                          messageList: MessagesDB(
                            mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                            mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                            infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                            mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [])
                        },
                        $set: { timeLastMessage: new Date(mess.CreateAt) }
                      }).catch(function (err) {
                        console.log(err);
                      });
                    }
                  }).catch(function (err) {
                    console.log(err);
                  });
                  MarkUnreaderMessage(ConversationID, SenderID, listMember);
                }
                else { // text chứa link; bắn 2 lần socket và lưu 2 tin nhắn 
                  mess.InfoLink = {};
                  mess.InfoLink.HaveImage = "False";
                  let urlCheck = new RegExp("[a-zA-Z\d]+://(\w+:\w+@)?([a-zA-Z\d.-]+\.[A-Za-z]{2,4})(:\d+)?(/.*)?")
                  if (urlCheck.test(mess.Message)) {
                    let link = mess.Message.slice(mess.Message.indexOf('http'), mess.Message.length);
                    getLinkPreview(
                      `${link}`
                    ).then((doc) => {
                      if (doc) {
                        mess.InfoLink.LinkHome = doc.url;
                        mess.InfoLink.Title = doc.title || "Không tìm thấy thông tin website";
                        mess.InfoLink.Description = doc.description || null;
                        mess.InfoLink.Image = (doc.images.length > 0) ? doc.images[0] : null;
                        if (mess.InfoLink.Image) {
                          mess.InfoLink.HaveImage = "True";
                        }
                        mess.InfoLink.MessageID = null;
                        mess.InfoLink.TypeLink = null;
                        mess.InfoLink.IsNotification = 0;
                        // bắn trc 1 socket cho bên app render 
                        mess.Message = doc.url;
                        mess.MessageType = "link";
                        mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000001 + 8}_${SenderID}`;
                        socket.emit("SendMessage", mess, listMember);
                        Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                          if (counter && counter.length > 0 && counter[0].countID) {
                            const filter = { name: "MessageId" };
                            const update = { countID: counter[0].countID + 1 };
                            await Counter.updateOne(filter, update);

                            Conversation.updateOne({ _id: ConversationID }, {
                              $push: {
                                messageList: MessagesDB(
                                  `${((new Date).getTime() * 10000) + 621355968000000001 + 8}_${SenderID}`, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                  mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                  infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                  mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [])
                              },
                              $set: { timeLastMessage: new Date(mess.CreateAt) }
                            }).catch(function (err) {
                              console.log(err);
                            });
                          }
                        }).catch(function (err) {
                          console.log(err);
                        });
                        MarkUnreaderMessage(ConversationID, SenderID, listMember);
                      }
                    }).catch((e) => {
                      mess.InfoLink.Title = "Không tìm thấy thông tin website";
                      mess.InfoLink.Description = null;
                      mess.InfoLink.Image = null;
                      mess.InfoLink.MessageID = null;
                      mess.InfoLink.TypeLink = null;
                      mess.InfoLink.LinkHome = link.trim();
                      mess.InfoLink.IsNotification = 0;
                      // bắn trc 1 socket cho bên app render
                      mess.Message = link.trim();
                      mess.MessageType = "link";
                      mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000000 + 8}_${SenderID}`;
                      socket.emit("SendMessage", mess, listMember);
                      Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                        if (counter && counter.length > 0 && counter[0].countID) {
                          const filter = { name: "MessageId" };
                          const update = { countID: counter[0].countID + 1 };
                          await Counter.updateOne(filter, update);

                          Conversation.updateOne({ _id: ConversationID }, {
                            $push: {
                              messageList: MessagesDB(
                                mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [])
                            },
                            $set: { timeLastMessage: new Date(mess.CreateAt) }
                          }).catch(function (err) {
                            console.log(err);
                          });
                        }
                      }).catch(function (err) {
                        console.log(err);
                      });
                      MarkUnreaderMessage(ConversationID, SenderID, listMember);
                    });
                  }
                }
              }
              // đánh dấu tin nhắn chưa đọc 
              MarkUnreaderMessage(ConversationID, SenderID, listMember);
            }

            let listUserOffline = [];
            User.find({ _id: { $in: listMember } }, { isOnline: 1, userName: 1 }).then((listUser) => {
              if (listUser && listUser.length) {
                for (let i = 0; i < listMember.length; i++) {
                  let a = listUser.find((e) => e._id == listMember[i]);
                  if (a) {
                    if (a.isOnline == 0) {
                      listUserOffline.push(listMember[i]);
                    }
                  }

                };
                if (listUserOffline.length) {
                  axios({
                    method: "post",
                    url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                    data: {
                      IdReceiver: JSON.stringify(listUserOffline),
                      conversationId: ConversationID,
                      sendername: listUser.find((e) => e._id == mess.SenderID) ? listUser.find((e) => e._id == mess.SenderID).userName : "",
                      ava: 'a',
                      mess: mess.Message,
                      type: 'text',
                      idSender: mess.SenderID,
                      mask: 1
                    },
                    headers: { "Content-Type": "multipart/form-data" }
                  }).catch((e) => {
                    console.log(e)
                  })
                }
              }
            }).catch((e) => { console.log(e) })
          }).catch(function (err) {
            console.log(err);
          });

      }
      else {
        res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
      }
    }
    else {
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  }
  catch (e) {
    console.log(e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

export const DeleteListMessageOneSide = async (req, res) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status) {
        console.log("Token hop le, DeleteListMessageOneSide")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    const listMessId = req.body.ListMessId.replace('[', '').replace(']', '').split(',')
    const conversationId = Number(req.body.ConversationID);
    const userId = req.body.userId
    const conv = await Conversation.findOne({ _id: conversationId }, { 'memberList.memberId': 1 })
    const memberList = []
    for (let i = 0; i < conv.memberList.length; i++) {
      memberList.push(conv.memberList[i].memberId)
    }
    for (let i = 0; i < listMessId.length; i++) {
      const messageInfo = {
        ConversationID: conversationId,
        MessageID: listMessId[i],
      }
      socket.emit('DeleteMessage', messageInfo, memberList)
    }
    const data = {
      result: true,
      message: "Xóa tin nhắn thành công",
    };
    res.send({ data, error: null });

    await Conversation.updateMany(
      { _id: conversationId, "messageList._id": { $in: listMessId } },
      {
        $set: {
          "messageList.$[message].isEdited": 2,
          timeLastChange: Date.now()
        },
        $push: {
          "messageList.$[message].listDeleteUser": Number(userId)
        }
      },
      {
        arrayFilters: [{ 'message._id': { $in: listMessId } }]
      }
    )

    return true;
  } catch (err) {
    console.log(err)
    if (err) return res.send(createError(200, err.message));
  }
}

export const SendMessageIdChat = async (req, res) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.SenderID)) {
        console.log("Token hop le, SendMessage")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    if (req.body && req.body.UserID && (!isNaN(req.body.UserID)) && req.body.SenderID && (!isNaN(req.body.SenderID))) {
      let UserID = Number(req.body.UserID);
      let SenderID = Number(req.body.SenderID);
      let Message = req.body.Message ? String(req.body.Message) : "";
      let Quote = req.body.Quote ? String(req.body.Quote) : "";
      let Profile = req.body.Profile ? String(req.body.Profile) : "";
      let ListTag = req.body.ListTag ? String(req.body.ListTag) : "";
      let File = req.body.File ? String(req.body.File) : "";
      let ListMember = req.body.ListMember ? String(req.body.ListMember) : "";
      let IsOnline = req.body.IsOnline ? String(req.body.IsOnline) : "";
      let conversationName = req.body.conversationName ? String(req.body.conversationName) : "";
      let isGroup = (req.body.isGroup && (!isNaN(req.body.isGroup))) ? Number(req.body.isGroup) : 0;
      let deleteTime = (req.body.deleteTime && (!isNaN(req.body.deleteTime))) ? Number(req.body.deleteTime) : 0;
      let deleteType = (req.body.deleteType && (!isNaN(req.body.deleteType))) ? Number(req.body.deleteType) : 0;
      let liveChat = req.body.liveChat ? String(req.body.liveChat) : null;
      let infoSupport = req.body.InfoSupport ? String(req.body.InfoSupport) : null;
      let timeLivechat = req.body.TimeLiveChat ? req.body.TimeLiveChat : null;

      // add friend ntd with uv. 
      if (req.body.ContactId) {
        AddFriend(Number(req.body.SenderID), Number(req.body.ContactId));
      }
      if (req.body.MessageType && (req.body.File || req.body.Message || req.body.Quote)) {
        // let finduser = User.findOne({_id:SenderId})
        let MessageType = String(req.body.MessageType);
        let mess = {};
        mess.MessageID = "";
        if (req.body.MessageID && (req.body.MessageID.trim() != "")) {
          mess.MessageID = req.body.MessageID;
        }
        else {
          mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000000 + 8}_${SenderID}`;
        }
        mess.CreateAt = `${JSON.parse(JSON.stringify(new Date(new Date().setHours(new Date().getHours() + 7)))).replace("Z", "")}+07:00`;
        res.json({
          data: {
            countMessage: 0,
            listMessages: null,
            message: "Gửi thành công",
            messageId: mess.MessageID,
            createAt: mess.CreateAt,
            message_info: null,
            result: true,
            senderName: "Hỗ trợ khách hàng"
          },
          error: null
        })

        const ConversationID = await FCreateNewConversation(UserID, SenderID)
        mess.ConversationID = ConversationID;
        mess.SenderID = SenderID;
        mess.MessageType = MessageType;
        mess.Message = Message;
        mess.ListTag = ListTag;
        mess.DeleteTime = deleteTime;
        mess.DeleteType = deleteType;
        mess.DeleteDate = String('0001-01-01T00:00:00.000+00:00');
        mess.IsFavorite = 0;
        if (!req.body.Quote || (String(req.body.Quote).trim() == "") || (String(req.body.Quote) == "null")) {
          mess.QuoteMessage = MessageQuote("", "", 0, "", "", `${JSON.parse(JSON.stringify(new Date())).replace("Z", "")}6769+07:00`);
        }
        else {
          mess.QuoteMessage = ConvertToObjectQuote(req.body.Quote);
          mess.QuoteMessage.SenderID = Number(mess.QuoteMessage.SenderID);
        }

        if (req.body.File && (String(req.body.File) != "null")) {
          mess.ListFile = JSON.parse(req.body.File);
          for (let i = 0; i < mess.ListFile.length; i++) {
            if (mess.ListFile[i].FullName && (mess.ListFile[i].FullName.trim() != "")) {
              mess.ListFile[i].NameDownload = mess.ListFile[i].FullName.replace(/[ +!@#$%^&*]/g, '');
              // mess.ListFile[i].FullName = mess.ListFile[i].FullName.replace(/[ +!@#$%^&*]/g, '');
            }
            else {
              mess.ListFile[i].NameDownload = "";
              mess.ListFile[i].FullName = "";
            }
            if ((!isNaN(mess.ListFile[i].Height))) {
              mess.ListFile[i].Height = Number(mess.ListFile[i].Height);
            }
            else {
              mess.ListFile[i].Height = 10;
            }

            if ((!isNaN(mess.ListFile[i].Width))) {
              mess.ListFile[i].Width = Number(mess.ListFile[i].Width);
            }
            else {
              mess.ListFile[i].Width = 10;
            };
            if ((!isNaN(mess.ListFile[i].SizeFile))) {
              mess.ListFile[i].SizeFile = Number(mess.ListFile[i].SizeFile);
            }
            else {
              mess.ListFile[i].SizeFile = 10;
            };
            if (mess.ListFile[i].FullName == 'null') {
              mess.ListFile[i].FullName = mess.ListFile[i].NameDisplay;
            };
            // console.log("Obj file sau khi sua:0",mess.ListFile[i])
          };
          // console.log(mess.ListFile)
        }
        else {
          mess.ListFile = null;
        }


        if (req.body.Profile && (String(req.body.Profile) != "null")) {
          let obj = ConvertToObject(req.body.Profile);
          mess.Message = obj.id;
          mess.UserProfile = {};
          mess.UserProfile.AcceptMessStranger = Number(obj.acceptMessStranger)
          mess.UserProfile.Active = Number(obj.active)
          mess.UserProfile.AvatarUser = obj.avatarUser;
          mess.UserProfile.CompanyId = Number(obj.companyId)
          mess.UserProfile.CompanyName = obj.companyName;
          mess.UserProfile.Email = obj.email;
          mess.UserProfile.FriendStatus = obj.friendStatus;
          mess.UserProfile.FromWeb = obj.fromWeb;
          mess.UserProfile.ID = Number(obj.id)
          mess.UserProfile.ID365 = (!isNaN(obj.iD365)) ? Number(obj.iD365) : 0;
          mess.UserProfile.IDTimViec = Number(obj.idTimViec)
          mess.UserProfile.LastActive = `${JSON.parse(JSON.stringify(new Date(new Date().setHours(new Date().getHours() + 7)))).replace("Z", "")}+07:00`;
          mess.UserProfile.LinkAvatar = obj.avatarUser;
          mess.UserProfile.Looker = Number(obj.looklooker)
          mess.UserProfile.NotificationAcceptOffer = 1;
          mess.UserProfile.NotificationAllocationRecall = 1;
          mess.UserProfile.NotificationCalendar = 1;
          mess.UserProfile.NotificationChangeProfile = 1;
          mess.UserProfile.NotificationChangeSalary = 1;
          mess.UserProfile.NotificationCommentFromRaoNhanh = 1;
          mess.UserProfile.NotificationCommentFromTimViec = 1;
          mess.UserProfile.NotificationDecilineOffer = 1;
          mess.UserProfile.NotificationMissMessage = 1;
          mess.UserProfile.NotificationNTDApplying = 0;
          mess.UserProfile.NotificationNTDExpiredPin = 1;
          mess.UserProfile.NotificationNTDExpiredRecruit = 1;
          mess.UserProfile.NotificationNTDPoint = 1;
          mess.UserProfile.NotificationNewPersonnel = 1;
          mess.UserProfile.NotificationOffer = 1;
          mess.UserProfile.NotificationPayoff = 1;
          mess.UserProfile.NotificationPersonnelChange = 1;
          mess.UserProfile.NotificationReport = 1;
          mess.UserProfile.NotificationRewardDiscipline = 1;
          mess.UserProfile.NotificationSendCandidate = 1;
          mess.UserProfile.NotificationTag = 1;
          mess.UserProfile.NotificationTransferAsset = 1;
          mess.UserProfile.Password = obj.password;
          mess.UserProfile.Phone = obj.phone;
          mess.UserProfile.Status = obj.status;
          mess.UserProfile.StatusEmotion = Number(obj.statusEmotion);
          mess.UserProfile.Type365 = Number(obj.type365);
          mess.UserProfile.Type_Pass = Number(obj.type_Pass);
          mess.UserProfile.UserName = obj.userName;
          mess.UserProfile.isOnline = Number(obj.isOnline);
          mess.UserProfile.secretCode = obj.secretCode;
          mess.UserProfile.userQr = obj.userQr;
          mess.UserProfile.Looker = 0;
        }
        else {
          mess.UserProfile = {};
          mess.UserProfile.AcceptMessStranger = 0
          mess.UserProfile.Active = 0
          mess.UserProfile.AvatarUser = null;
          mess.UserProfile.CompanyId = 0
          mess.UserProfile.CompanyName = null;
          mess.UserProfile.Email = null;
          mess.UserProfile.FriendStatus = null;
          mess.UserProfile.FromWeb = null;
          mess.UserProfile.ID = 0
          mess.UserProfile.ID365 = 0
          mess.UserProfile.IDTimViec = 0
          mess.UserProfile.LastActive = `${JSON.parse(JSON.stringify(new Date(new Date().setHours(new Date().getHours() + 7)))).replace("Z", "")}+07:00`;
          mess.UserProfile.LinkAvatar = null;
          mess.UserProfile.Looker = 0
          mess.UserProfile.NotificationAcceptOffer = 0;
          mess.UserProfile.NotificationAllocationRecall = 0;
          mess.UserProfile.NotificationCalendar = 0;
          mess.UserProfile.NotificationChangeProfile = 0;
          mess.UserProfile.NotificationChangeSalary = 0;
          mess.UserProfile.NotificationCommentFromRaoNhanh = 0;
          mess.UserProfile.NotificationCommentFromTimViec = 0;
          mess.UserProfile.NotificationDecilineOffer = 0;
          mess.UserProfile.NotificationMissMessage = 0;
          mess.UserProfile.NotificationNTDApplying = 0;
          mess.UserProfile.NotificationNTDExpiredPin = 0;
          mess.UserProfile.NotificationNTDExpiredRecruit = 0;
          mess.UserProfile.NotificationNTDPoint = 0;
          mess.UserProfile.NotificationNewPersonnel = 0;
          mess.UserProfile.NotificationOffer = 0;
          mess.UserProfile.NotificationPayoff = 0;
          mess.UserProfile.NotificationPersonnelChange = 0;
          mess.UserProfile.NotificationReport = 0;
          mess.UserProfile.NotificationRewardDiscipline = 0;
          mess.UserProfile.NotificationSendCandidate = 0;
          mess.UserProfile.NotificationTag = 0;
          mess.UserProfile.NotificationTransferAsset = 0;
          mess.UserProfile.Password = null;
          mess.UserProfile.Phone = null;
          mess.UserProfile.Status = null;
          mess.UserProfile.StatusEmotion = 0;
          mess.UserProfile.Type365 = 0;
          mess.UserProfile.Type_Pass = 0;
          mess.UserProfile.UserName = null;
          mess.UserProfile.isOnline = 0;
          mess.UserProfile.secretCode = null;
          mess.UserProfile.userQr = null;
        }

        if (mess.DeleteType == 0 && mess.DeleteTime > 0) {
          mess.DeleteDate = (new Date()).setSeconds(new Date().getSeconds() + Number(deleteTime));
        }

        // lấy id kèm mảng trạng thái online 
        let listMember = [];
        let isOnline = [];
        Conversation.findOne({ _id: ConversationID }, { "memberList.memberId": 1, "memberList.liveChat": 1, typeGroup: 1 })
          .then(async (conversation) => {

            // take data user 
            if (conversation && conversation.memberList) {
              for (let i = 0; i < conversation.memberList.length; i++) {
                listMember.push(conversation.memberList[i].memberId);
                isOnline.push(1);
              }
            }

            // live chat
            mess.liveChat = null;
            let typeSendLiveChat = "";
            if (liveChat) {
              mess.liveChat = null;
            }
            else if (conversation && conversation.memberList && (conversation.memberList.length > 0)) {
              let liveChatDB = conversation.memberList.find(e => e.memberId == SenderID);
              if (liveChatDB) {
                liveChatDB = liveChatDB.liveChat;
              }
              if (liveChatDB && liveChatDB.clientId) {  // người gửi là client 
                typeSendLiveChat = "ClientSend";
                listMember = listMember.filter(e => e != SenderID); // id tài khoản tư vấn viên 
                liveChatDB.clientName = liveChatDB.clientName ? liveChatDB.clientName : liveChatDB.clientId;
                mess.liveChat = InfoLiveChat(liveChatDB.clientId, liveChatDB.clientName,
                  `${urlImgHost}avatar/${String(liveChatDB.clientName).trim()[0].toUpperCase()}_${getRandomInt(1, 4)}.png`,
                  liveChatDB.fromWeb
                );
              }
              else {  // người gửi là tư vấn viên 
                if (conversation.typeGroup == "liveChat") {
                  liveChatDB = conversation.memberList.find(e => e.memberId != SenderID);
                  liveChatDB = liveChatDB.liveChat;
                  if (liveChatDB) {
                    typeSendLiveChat = "HostSend";
                    listMember = listMember.filter(e => e == SenderID);// id tài khoản tư vấn viên 
                    liveChatDB.clientName = liveChatDB.clientName ? liveChatDB.clientName : liveChatDB.clientId;
                    mess.liveChat = InfoLiveChat(liveChatDB.clientId, liveChatDB.clientName,
                      `${urlImgHost}avatar/${String(liveChatDB.clientName.trim()[0]).toUpperCase()}_${getRandomInt(1, 4)}.png`,
                      liveChatDB.fromWeb
                    );
                  }
                }
              }
            }

            // to main conversation group 
            let infoSupportDB = null; // tạo infor support để insert vào base 
            let LiveChatInfor = null;
            if (infoSupport) {
              let InfoSupport = ConvertToObject(infoSupport);

              if (InfoSupport.Title == "Tin nhắn nhỡ") {
                mess.InfoSupport = {};
                mess.InfoSupport.HaveConversation = 0;
                mess.InfoSupport.Message = `${InfoSupport.Message}${infoSupport.split(",")[2]}${infoSupport.split(",")[3]}${infoSupport.split(",")[4].replace('"', '').replace('}', '')}`;
                mess.InfoSupport.Status = Number(InfoSupport.Status);
                mess.InfoSupport.SupportId = mess.MessageID;
                mess.InfoSupport.Time = "0001-01-01T00:00:00";
                mess.InfoSupport.Title = InfoSupport.Title;
                mess.InfoSupport.UserId = Number(InfoSupport.UserId);
                mess.InfoSupport.userName = null;

                infoSupportDB = InfoSupportDB(mess.InfoSupport.Title, mess.InfoSupport.Message,
                  mess.InfoSupport.SupportId, mess.InfoSupport.HaveConversation,
                  mess.InfoSupport.UserId, mess.InfoSupport.Status, String('0001-01-01T00:00:00.000+00:00')
                );

                mess.LiveChat = {};
                mess.LiveChat.ClientAvatar = `${urlImgHost()}avatar/K_4.png`;
                mess.LiveChat.ClientId = infoSupport.split(",")[2].split(":")[1].trim();
                mess.LiveChat.ClientName = `Khách hàng ${mess.InfoSupport.Message.split(":")[2].split(",")[0].replace('tôi cần bạn hỗ trợ!', '').trim()}`
                mess.LiveChat.FromWeb = mess.InfoSupport.Message.split(":")[2].split(",")[0].replace('tôi cần bạn hỗ trợ!', '').trim().split(".")[0];
                LiveChatInfor = LiveChatDB(mess.LiveChat.ClientId, mess.LiveChat.ClientName, mess.LiveChat.FromWeb)
                socket.emit("SendMessage", mess, [mess.LiveChat.ClientId]); // gui lai chinh no 
                // socket.emit("TimeLiveChat", timeLivechat, [mess.LiveChat.ClientId]); 
              }
              // crm 
              else if (InfoSupport.Status && (Number(InfoSupport.Status) == 3)) {
                mess.InfoSupport = {};
                mess.InfoSupport.HaveConversation = 0;
                mess.InfoSupport.Message = req.body.SmallTitile
                mess.InfoSupport.Status = 0;
                mess.InfoSupport.SupportId = mess.MessageID;
                mess.InfoSupport.Time = "0001-01-01T00:00:00";
                mess.InfoSupport.Title = InfoSupport.Title || "Hỗ trợ";
                mess.InfoSupport.UserId = 0;
                mess.InfoSupport.userName = null;

                infoSupportDB = InfoSupportDB(mess.InfoSupport.Title, mess.InfoSupport.Message,
                  mess.InfoSupport.SupportId, mess.InfoSupport.HaveConversation,
                  mess.InfoSupport.UserId, mess.InfoSupport.Status || 0, String('0001-01-01T00:00:00.000+00:00')
                );
                mess.LiveChat = {};
                mess.LiveChat.ClientAvatar = `${urlImgHost()}avatar/K_4.png`;
                mess.LiveChat.ClientId = InfoSupport.ClientId;
                mess.LiveChat.ClientName = InfoSupport.ClientName;
                mess.LiveChat.FromWeb = InfoSupport.FromWeb;
                LiveChatInfor = LiveChatDB(mess.LiveChat.ClientId, mess.LiveChat.ClientName, mess.LiveChat.FromWeb)
                socket.emit("SendMessage", mess, [mess.LiveChat.ClientId]); // gui lai chinh no 
                // socket.emit("TimeLiveChat", timeLivechat, [mess.LiveChat.ClientId]); 
              }
              else {
                mess.InfoSupport = {};
                mess.InfoSupport.HaveConversation = 0;
                if (infoSupport.split(",")[4]) {
                  mess.InfoSupport.Message = `${InfoSupport.Message}${infoSupport.split(",")[2]}${infoSupport.split(",")[3]}${infoSupport.split(",")[4].replace('"', '').replace('}', '')}`;
                }
                else {
                  mess.InfoSupport.Message = `${InfoSupport.Message}${infoSupport.split(",")[2]}${infoSupport.split(",")[3]}`
                }
                mess.InfoSupport.Status = 0;
                mess.InfoSupport.SupportId = mess.MessageID;
                mess.InfoSupport.Time = "0001-01-01T00:00:00";
                mess.InfoSupport.Title = InfoSupport.Title || "Hỗ trợ";
                mess.InfoSupport.UserId = 0;
                mess.InfoSupport.userName = null;

                infoSupportDB = InfoSupportDB(mess.InfoSupport.Title, mess.InfoSupport.Message,
                  mess.InfoSupport.SupportId, mess.InfoSupport.HaveConversation,
                  mess.InfoSupport.UserId, mess.InfoSupport.Status || 0, String('0001-01-01T00:00:00.000+00:00')
                );

                mess.LiveChat = {};
                mess.LiveChat.ClientAvatar = `${urlImgHost()}avatar/K_4.png`;
                mess.LiveChat.ClientId = infoSupport.split(",")[2].split(":")[1].trim();
                mess.LiveChat.ClientName = `Khách hàng ${mess.InfoSupport.Message.split(":")[2].split(",")[0].replace('tôi cần bạn hỗ trợ!', '').trim()}`
                mess.LiveChat.FromWeb = mess.InfoSupport.Message.split(":")[2].split(",")[0].replace('tôi cần bạn hỗ trợ!', '').trim().split(".")[0];
                LiveChatInfor = LiveChatDB(mess.LiveChat.ClientId, mess.LiveChat.ClientName, mess.LiveChat.FromWeb)
                socket.emit("SendMessage", mess, [mess.LiveChat.ClientId]); // gui lai chinh no 
              }

            };

            // to single conv live chat
            if (mess.liveChat != null) {
              // config cho giống live chat render 
              mess.EmotionMessage = null;
              mess.File = mess.ListFile;
              mess.InfoLink = null;
              mess.Profile = null;
              mess.InfoSupport = null;
              mess.IsClicked = 0;
              mess.IsEdited = 0;
              mess.Link = null;
              mess.LinkNotification = null;
              mess.Quote = mess.QuoteMessage;
              mess.SenderName = "Hỗ trợ khách hàng";
              mess.LiveChat = mess.liveChat;
              let listDevices = [];
              listDevices.push(mess.liveChat.ClientId);
              let currentWeb = mess.liveChat.FromWeb;
              if (typeSendLiveChat == "HostSend") {
                mess.LiveChat = null;
                mess.liveChat = null;
              }
              // sendNotificationToTimViec(mess, conversationName, mess.ConversationID, listMember, isOnline, isGroup, true);
              if (MessageType != "link") {
                socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);

                if (MessageType == "sendFile" || MessageType == "sendPhoto" || MessageType == "sendVoice") {
                  let findSend = [];
                  for (let i = 0; i < mess.ListFile.length; i++) {
                    findSend.push(FileSendDB((!isNaN(mess.ListFile[i].SizeFile)) ? Number(mess.ListFile[i].SizeFile) : 100, mess.ListFile[i].FullName ? String(mess.ListFile[i].FullName) : String(mess.ListFile[i].NameDisplay), Number(mess.ListFile[i].Height), Number(mess.ListFile[i].Width)))
                  };
                  Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                    if (counter && counter.length > 0 && counter[0].countID) {
                      const filter = { name: "MessageId" };
                      const update = { countID: counter[0].countID + 1 };
                      await Counter.updateOne(filter, update);
                      Conversation.updateOne({ _id: ConversationID }, { $set: { timeLastMessage: new Date(mess.CreateAt) } }).catch((e) => (console.log(e)));
                      if (typeSendLiveChat == "ClientSend") {
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType,
                              mess.Message, mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0), findSend, EmotionMessageDBDefault(),
                              mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB,
                              LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                              [])
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                        });
                      }
                      else {
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType,
                              mess.Message, mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0), findSend, EmotionMessageDBDefault(),
                              mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                        });
                      }
                    }
                  }).catch(function (err) {
                    console.log(err);
                  });
                }
                else if (MessageType == "map") {
                  let z = mess.Message.split(",");
                  let link = `https://www.google.com/maps/search/${z[0].trim()},${z[1].trim()}/${z[0].trim()},${z[1].trim()},10z?hl=vi`;
                  mess.InfoLink = {};
                  mess.InfoLink.HaveImage = "False";
                  let index = link.indexOf("/", 9);
                  if (index != -1) {
                    mess.InfoLink.LinkHome = link.slice(0, index);
                  }
                  else {
                    mess.InfoLink.LinkHome = link;
                  }
                  axios.get(link).then((doc) => {
                    if (doc && doc.data) {
                      mess.InfoLink.Title = String(doc.data).split("<title>")[1].split("</title>")[0].trim() || "Không tìm thấy thông tin website";
                      mess.InfoLink.Description = null;
                      let Image = String(doc.data).split(`property="og:image`)[0].replace(`"`, '');
                      mess.InfoLink.Image = Image.split(`<meta content=`)[Image.split(`<meta content=`).length - 1].replace('"', ``).replace('"', ``);
                      mess.InfoLink.Image = String(mess.InfoLink.Image).replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').trim();
                      if (mess.InfoLink.Image) {
                        mess.InfoLink.HaveImage = "True";
                      }
                      mess.InfoLink.MessageID = null;
                      mess.InfoLink.TypeLink = null;

                      // gửi lại link bằng socket 
                      socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);
                      // thêm dữ liệu vào base
                      Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                        if (counter && counter.length > 0 && counter[0].countID) {
                          const filter = { name: "MessageId" };
                          const update = { countID: counter[0].countID + 1 };
                          await Counter.updateOne(filter, update);
                          if (typeSendLiveChat == "ClientSend") {
                            Conversation.updateOne({ _id: ConversationID }, {
                              $push: {
                                messageList: MessagesDB(
                                  mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                  mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                  infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                  mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB,
                                  LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                                  [])
                              },
                              $set: { timeLastMessage: new Date(mess.CreateAt) }
                            }).catch(function (err) {
                              console.log(err);
                            });
                          }
                          else {
                            Conversation.updateOne({ _id: ConversationID }, {
                              $push: {
                                messageList: MessagesDB(
                                  mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                  mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                  infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                  mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                              },
                              $set: { timeLastMessage: new Date(mess.CreateAt) }
                            }).catch(function (err) {
                              console.log(err);
                            });
                          }
                        }
                      }).catch(function (err) {
                        console.log(err);
                      });
                    }
                  }).catch((e) => {
                    console.log(e)
                  })
                }
                else {

                  Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                    if (counter && counter.length > 0 && counter[0].countID) {
                      const filter = { name: "MessageId" };
                      const update = { countID: counter[0].countID + 1 };
                      await Counter.updateOne(filter, update);
                      if (typeSendLiveChat == "ClientSend") {
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                              mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0),
                              mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB,
                              LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                              [])
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                        });
                      }
                      else {
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                              mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0),
                              mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                        });
                      }
                    }
                  }).catch(function (err) {
                    console.log(err);
                  });
                }
              }

              if ((MessageType == "link") || (MessageType == "text")) {
                if (MessageType == "link") { // gửi socket 2 lần, lưu vào base 1 tin nhắn 
                  socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);
                  mess.InfoLink = {};
                  mess.InfoLink.HaveImage = "False";
                  if (String(mess.Message)[String(mess.Message).length - 1] == "/") {
                    mess.Message = String(mess.Message).slice(0, String(mess.Message).length - 1)
                  };
                  mess.InfoLink.LinkHome = mess.Message;

                  let doc = await getLinkPreview(
                    `${mess.Message}`
                  );
                  if (doc) {
                    mess.InfoLink.Title = doc.title || "Không tìm thấy thông tin website";
                    mess.InfoLink.Description = doc.description || null;
                    mess.InfoLink.Image = (doc.images.length > 0) ? doc.images[0] : null;
                    if (mess.InfoLink.Image) {
                      mess.InfoLink.HaveImage = "True";
                    }
                    mess.InfoLink.MessageID = null;
                    mess.InfoLink.TypeLink = null;
                    mess.InfoLink.IsNotification = 0;
                  }
                  else {
                    mess.InfoLink.Title = "Không tìm thấy thông tin website";
                    mess.InfoLink.Description = null;
                    mess.InfoLink.Image = null;
                    mess.InfoLink.MessageID = null;
                    mess.InfoLink.TypeLink = null;
                    mess.InfoLink.IsNotification = 0;
                  }
                  socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);
                  Conversation.updateOne({ _id: ConversationID }, { $set: { timeLastMessage: new Date(mess.CreateAt) } }).catch((e) => (console.log(e)));
                  // insert link to base 
                  Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                    if (counter && counter.length > 0 && counter[0].countID) {
                      const filter = { name: "MessageId" };
                      const update = { countID: counter[0].countID + 1 };
                      await Counter.updateOne(filter, update);
                      if (typeSendLiveChat == "ClientSend") {
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                              mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                              infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                              mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB,
                              LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                              [])
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                        });
                      }
                      else {
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                              mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                              infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                              mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                        });
                      }
                    }
                  }).catch(function (err) {
                    console.log(err);
                  });
                  MarkUnreaderMessage(ConversationID, SenderID, listMember);
                }
                else { // text chứa link; bắn 2 lần socket và lưu 2 tin nhắn 
                  mess.InfoLink = {};
                  mess.InfoLink.HaveImage = "False";
                  let urlCheck = new RegExp("[a-zA-Z\d]+://(\w+:\w+@)?([a-zA-Z\d.-]+\.[A-Za-z]{2,4})(:\d+)?(/.*)?")
                  if (urlCheck.test(mess.Message)) {
                    let link = mess.Message.slice(mess.Message.indexOf('http'), mess.Message.length);
                    getLinkPreview(
                      `${link}`
                    ).then((doc) => {
                      if (doc) {

                        mess.InfoLink.LinkHome = doc.url;
                        mess.InfoLink.Title = doc.title || "Không tìm thấy thông tin website";
                        mess.InfoLink.Description = doc.description || null;
                        mess.InfoLink.Image = (doc.images.length > 0) ? doc.images[0] : null;
                        if (mess.InfoLink.Image) {
                          mess.InfoLink.HaveImage = "True";
                        }
                        mess.InfoLink.MessageID = null;
                        mess.InfoLink.TypeLink = null;
                        mess.InfoLink.IsNotification = 0;
                        // bắn trc 1 socket cho bên app render 
                        mess.Message = doc.url;
                        mess.MessageType = "link";
                        mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000000 + 8}_${SenderID}`;
                        socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);
                        Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                          if (counter && counter.length > 0 && counter[0].countID) {
                            const filter = { name: "MessageId" };
                            const update = { countID: counter[0].countID + 1 };
                            await Counter.updateOne(filter, update);
                            if (typeSendLiveChat == "ClientSend") {
                              Conversation.updateOne({ _id: ConversationID }, {
                                $push: {
                                  messageList: MessagesDB(
                                    mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                    mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                    infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                    mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate,
                                    infoSupportDB,
                                    LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                                    [])
                                },
                                $set: { timeLastMessage: new Date(mess.CreateAt) }
                              }).catch(function (err) {
                                console.log(err);
                              });
                            } else {
                              Conversation.updateOne({ _id: ConversationID }, {
                                $push: {
                                  messageList: MessagesDB(
                                    mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                    mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                    infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                    mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                                },
                                $set: { timeLastMessage: new Date(mess.CreateAt) }
                              }).catch(function (err) {
                                console.log(err);
                              });
                            }
                          }
                        }).catch(function (err) {
                          console.log(err);
                        });
                        MarkUnreaderMessage(ConversationID, SenderID, listMember);
                      }
                    }).catch((e) => {
                      mess.InfoLink.Title = "Không tìm thấy thông tin website";
                      mess.InfoLink.Description = null;
                      mess.InfoLink.Image = null;
                      mess.InfoLink.MessageID = null;
                      mess.InfoLink.TypeLink = null;
                      mess.InfoLink.LinkHome = link.trim();
                      mess.InfoLink.IsNotification = 0;
                      // bắn trc 1 socket cho bên app render
                      mess.Message = link.trim();
                      mess.MessageType = "link";
                      mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000000 + 8}_${SenderID}`;
                      socket.emit("SendMessage", mess, listMember, listDevices, "SuppportOtherWeb", currentWeb);
                      Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                        if (counter && counter.length > 0 && counter[0].countID) {
                          const filter = { name: "MessageId" };
                          const update = { countID: counter[0].countID + 1 };
                          await Counter.updateOne(filter, update);
                          if (typeSendLiveChat == "ClientSend") {
                            Conversation.updateOne({ _id: ConversationID }, {
                              $push: {
                                messageList: MessagesDB(
                                  mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                  mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                  infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                  mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB,
                                  LiveChatDB(mess.liveChat.ClientId, mess.liveChat.ClientName, mess.liveChat.FromWeb),
                                  [])
                              },
                              $set: { timeLastMessage: new Date(mess.CreateAt) }
                            }).catch(function (err) {
                              console.log(err);
                            });
                          }
                          else {
                            Conversation.updateOne({ _id: ConversationID }, {
                              $push: {
                                messageList: MessagesDB(
                                  mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                  mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                  infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                  mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, null, null, [])
                              },
                              $set: { timeLastMessage: new Date(mess.CreateAt) }
                            }).catch(function (err) {
                              console.log(err);
                            });
                          }
                        }
                      }).catch(function (err) {
                        console.log(err);
                      });
                      MarkUnreaderMessage(ConversationID, SenderID, listMember);
                    });
                  }
                }
              }
              // đánh dấu tin nhắn chưa đọc 
              MarkUnreaderMessage(ConversationID, SenderID, listMember);
            }
            else {

              sendNotificationToTimViec(mess, conversationName, mess.ConversationID, listMember, isOnline, isGroup, true);
              if (MessageType != "link") {

                if (req.body.from && (req.body.from == "Chat Winform")) {
                  if (MessageType == "sendFile" || MessageType == "sendPhoto") {
                    console.log("k ban socket vi api upload file da co")
                  }
                  else {
                    socket.emit("SendMessage", mess, listMember);
                  }
                }
                else {
                  socket.emit("SendMessage", mess, listMember);
                }

                if (MessageType == "sendFile" || MessageType == "sendPhoto" || MessageType == "sendVoice") {
                  // console.log('Send Mess File:', req.body.File)
                  let findSend = [];
                  for (let i = 0; i < mess.ListFile.length; i++) {
                    findSend.push(FileSendDB((!isNaN(mess.ListFile[i].SizeFile)) ? Number(mess.ListFile[i].SizeFile) : 100, mess.ListFile[i].FullName ? String(mess.ListFile[i].FullName) : String(mess.ListFile[i].NameDisplay), Number(mess.ListFile[i].Height), Number(mess.ListFile[i].Width)))
                  };
                  Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                    if (counter && counter.length > 0 && counter[0].countID) {
                      const filter = { name: "MessageId" };
                      const update = { countID: counter[0].countID + 1 };
                      await Counter.updateOne(filter, update);
                      Conversation.updateOne({ _id: ConversationID }, {
                        $push: {
                          messageList: MessagesDB(
                            mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType,
                            mess.Message, mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0), findSend, EmotionMessageDBDefault(),
                            mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [])
                        },
                        $set: { timeLastMessage: new Date(mess.CreateAt) }
                      }).catch(function (err) {
                        console.log(err);
                      });
                    }
                  }).catch(function (err) {
                    console.log(err);
                  });
                }
                else if (MessageType == "map") {
                  let z = mess.Message.split(",");
                  let link = `https://www.google.com/maps/search/${z[0].trim()},${z[1].trim()}/${z[0].trim()},${z[1].trim()},10z?hl=vi`;
                  mess.InfoLink = {};
                  mess.InfoLink.HaveImage = "False";
                  let index = link.indexOf("/", 9);
                  if (index != -1) {
                    mess.InfoLink.LinkHome = link.slice(0, index);
                  }
                  else {
                    mess.InfoLink.LinkHome = link;
                  }
                  axios.get(link).then((doc) => {
                    if (doc && doc.data) {
                      mess.InfoLink.Title = String(doc.data).split("<title>")[1].split("</title>")[0].trim() || "Không tìm thấy thông tin website";
                      mess.InfoLink.Description = null;
                      let Image = String(doc.data).split(`property="og:image`)[0].replace(`"`, '');
                      mess.InfoLink.Image = Image.split(`<meta content=`)[Image.split(`<meta content=`).length - 1].replace('"', ``).replace('"', ``);
                      mess.InfoLink.Image = String(mess.InfoLink.Image).replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').replace('amp;', '').trim();
                      if (mess.InfoLink.Image) {
                        mess.InfoLink.HaveImage = "True";
                      }
                      mess.InfoLink.MessageID = null;
                      mess.InfoLink.TypeLink = null;
                      socket.emit("SendMessage", mess, listMember);
                      // thêm dữ liệu vào base
                      Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                        if (counter && counter.length > 0 && counter[0].countID) {
                          const filter = { name: "MessageId" };
                          const update = { countID: counter[0].countID + 1 };
                          await Counter.updateOne(filter, update);
                          Conversation.updateOne({ _id: ConversationID }, {
                            $push: {
                              messageList: MessagesDB(
                                mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [])
                            },
                            $set: { timeLastMessage: new Date(mess.CreateAt) }
                          }).catch(function (err) {
                            console.log(err);
                          });
                        }
                      }).catch(function (err) {
                        console.log(err);
                      });
                    }
                  }).catch((e) => {
                    console.log(e)
                  })
                }
                else {
                  Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                    if (counter && counter.length > 0 && counter[0].countID) {
                      const filter = { name: "MessageId" };
                      const update = { countID: counter[0].countID + 1 };
                      await Counter.updateOne(filter, update);

                      Conversation.updateOne({ _id: ConversationID }, {
                        $push: {
                          messageList: MessagesDB(
                            mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, Message,
                            mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0, infoLink(null, null, null, null, 0),
                            mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [])
                        },
                        $set: { timeLastMessage: new Date(mess.CreateAt) }
                      }).catch(function (err) {
                        console.log(err);
                      });

                    }
                  }).catch(function (err) {
                    console.log(err);
                  });
                }
              }

              if ((MessageType == "link") || (MessageType == "text")) {
                if (MessageType == "link") { // gửi socket 2 lần, lưu vào base 1 tin nhắn 
                  socket.emit("SendMessage", mess, listMember);
                  mess.InfoLink = {};
                  mess.InfoLink.HaveImage = "False";
                  if (String(mess.Message)[String(mess.Message).length - 1] == "/") {
                    mess.Message = String(mess.Message).slice(0, String(mess.Message).length - 1)
                  };
                  mess.InfoLink.LinkHome = mess.Message;

                  getLinkPreview(
                    `${mess.Message}`
                  ).then((doc) => {
                    if (doc) {
                      mess.InfoLink.Title = doc.title || "Không tìm thấy thông tin website";
                      mess.InfoLink.Description = doc.description || null;
                      mess.InfoLink.Image = (doc.images && (doc.images.length > 0)) ? doc.images[0] : null;
                      if (mess.InfoLink.Image) {
                        mess.InfoLink.HaveImage = "True";
                      }
                      mess.InfoLink.MessageID = null;
                      mess.InfoLink.TypeLink = null;
                      mess.InfoLink.IsNotification = 0;
                    }
                    else {
                      mess.InfoLink.Title = "Không tìm thấy thông tin website";
                      mess.InfoLink.Description = null;
                      mess.InfoLink.Image = null;
                      mess.InfoLink.MessageID = null;
                      mess.InfoLink.TypeLink = null;
                      mess.InfoLink.IsNotification = 0;
                    }
                    socket.emit("SendMessage", mess, listMember);
                    // insert link to base 
                    Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                      if (counter && counter.length > 0 && counter[0].countID) {
                        const filter = { name: "MessageId" };
                        const update = { countID: counter[0].countID + 1 };
                        await Counter.updateOne(filter, update);
                        console.log("Data message Insert Link", infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0))
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                              mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                              infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                              mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [])
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                        });
                      }
                    }).catch(function (err) {
                      console.log(err);
                    });
                    MarkUnreaderMessage(ConversationID, SenderID, listMember);
                  }).catch((e) => {
                    mess.InfoLink.Title = "Không tìm thấy thông tin website";
                    mess.InfoLink.Description = null;
                    mess.InfoLink.Image = null;
                    mess.InfoLink.MessageID = null;
                    mess.InfoLink.TypeLink = null;
                    mess.InfoLink.IsNotification = 0;
                    socket.emit("SendMessage", mess, listMember);
                    // insert link to base 
                    Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {
                      if (counter && counter.length > 0 && counter[0].countID) {
                        const filter = { name: "MessageId" };
                        const update = { countID: counter[0].countID + 1 };
                        await Counter.updateOne(filter, update);
                        console.log("Data message Insert Link", infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0))
                        Conversation.updateOne({ _id: ConversationID }, {
                          $push: {
                            messageList: MessagesDB(
                              mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, MessageType, mess.Message,
                              mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                              infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                              mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [])
                          },
                          $set: { timeLastMessage: new Date(mess.CreateAt) }
                        }).catch(function (err) {
                          console.log(err);
                        });
                      }
                    }).catch(function (err) {
                      console.log(err);
                    });
                    MarkUnreaderMessage(ConversationID, SenderID, listMember);
                  })

                }
                else { // text chứa link; bắn 2 lần socket và lưu 2 tin nhắn 
                  mess.InfoLink = {};
                  mess.InfoLink.HaveImage = "False";
                  let urlCheck = new RegExp("[a-zA-Z\d]+://(\w+:\w+@)?([a-zA-Z\d.-]+\.[A-Za-z]{2,4})(:\d+)?(/.*)?")
                  if (urlCheck.test(mess.Message)) {
                    let link = mess.Message.slice(mess.Message.indexOf('http'), mess.Message.length);
                    getLinkPreview(
                      `${link}`
                    ).then((doc) => {
                      if (doc) {
                        mess.InfoLink.LinkHome = doc.url;
                        mess.InfoLink.Title = doc.title || "Không tìm thấy thông tin website";
                        mess.InfoLink.Description = doc.description || null;
                        mess.InfoLink.Image = (doc.images.length > 0) ? doc.images[0] : null;
                        if (mess.InfoLink.Image) {
                          mess.InfoLink.HaveImage = "True";
                        }
                        mess.InfoLink.MessageID = null;
                        mess.InfoLink.TypeLink = null;
                        mess.InfoLink.IsNotification = 0;
                        // bắn trc 1 socket cho bên app render 
                        mess.Message = doc.url;
                        mess.MessageType = "link";
                        mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000001 + 8}_${SenderID}`;
                        socket.emit("SendMessage", mess, listMember);
                        Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                          if (counter && counter.length > 0 && counter[0].countID) {
                            const filter = { name: "MessageId" };
                            const update = { countID: counter[0].countID + 1 };
                            await Counter.updateOne(filter, update);

                            Conversation.updateOne({ _id: ConversationID }, {
                              $push: {
                                messageList: MessagesDB(
                                  mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                  mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                  infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                  mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [])
                              },
                              $set: { timeLastMessage: new Date(mess.CreateAt) }
                            }).catch(function (err) {
                              console.log(err);
                            });
                          }
                        }).catch(function (err) {
                          console.log(err);
                        });
                        MarkUnreaderMessage(ConversationID, SenderID, listMember);
                      }
                    }).catch((e) => {
                      mess.InfoLink.Title = "Không tìm thấy thông tin website";
                      mess.InfoLink.Description = null;
                      mess.InfoLink.Image = null;
                      mess.InfoLink.MessageID = null;
                      mess.InfoLink.TypeLink = null;
                      mess.InfoLink.LinkHome = link.trim();
                      mess.InfoLink.IsNotification = 0;
                      // bắn trc 1 socket cho bên app render
                      mess.Message = link.trim();
                      mess.MessageType = "link";
                      mess.MessageID = `${((new Date).getTime() * 10000) + 621355968000000000 + 8}_${SenderID}`;
                      socket.emit("SendMessage", mess, listMember);
                      Counter.find({ name: "MessageId" }, { countID: 1 }).then(async (counter) => {// insert 1 tin nhắn link nữa vào base 
                        if (counter && counter.length > 0 && counter[0].countID) {
                          const filter = { name: "MessageId" };
                          const update = { countID: counter[0].countID + 1 };
                          await Counter.updateOne(filter, update);

                          Conversation.updateOne({ _id: ConversationID }, {
                            $push: {
                              messageList: MessagesDB(
                                mess.MessageID, Number(counter[0].countID) + 1, mess.SenderID, mess.MessageType, mess.Message,
                                mess.QuoteMessage.MessageID, mess.QuoteMessage.Message, mess.CreateAt, 0,
                                infoLink(mess.InfoLink.Title, mess.InfoLink.Description, mess.InfoLink.LinkHome, mess.InfoLink.Image, 0),
                                mess.ListFile, EmotionMessageDBDefault(), mess.DeleteTime, mess.DeleteType, mess.DeleteDate, infoSupportDB, LiveChatInfor, [])
                            },
                            $set: { timeLastMessage: new Date(mess.CreateAt) }
                          }).catch(function (err) {
                            console.log(err);
                          });
                        }
                      }).catch(function (err) {
                        console.log(err);
                      });
                      MarkUnreaderMessage(ConversationID, SenderID, listMember);
                    });
                  }
                }
              }
              // đánh dấu tin nhắn chưa đọc 
              MarkUnreaderMessage(ConversationID, SenderID, listMember);
            }

            let listUserOffline = [];
            User.find({ _id: { $in: listMember } }, { isOnline: 1, userName: 1 }).then((listUser) => {
              if (listUser && listUser.length) {
                for (let i = 0; i < listMember.length; i++) {
                  let a = listUser.find((e) => e._id == listMember[i]);
                  if (a) {
                    if (a.isOnline == 0) {
                      listUserOffline.push(listMember[i]);
                    }
                  }
                };
                if (listUserOffline.length) {
                  if (req.body.MessageType == "text") {
                    axios({
                      method: "post",
                      url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                      data: {
                        IdReceiver: JSON.stringify(listUserOffline),
                        conversationId: ConversationID,
                        sendername: listUser.find((e) => e._id == mess.SenderID) ? listUser.find((e) => e._id == mess.SenderID).userName : "",
                        ava: 'a',
                        mess: mess.Message,
                        type: 'text',
                        idSender: mess.SenderID,
                        mask: 1
                      },
                      headers: { "Content-Type": "multipart/form-data" }
                    }).catch((e) => {
                      console.log(e)
                    })
                  }
                  else if (req.body.MessageType == "map") {
                    axios({
                      method: "post",
                      url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                      data: {
                        IdReceiver: JSON.stringify(listUserOffline),
                        conversationId: ConversationID,
                        sendername: listUser.find((e) => e._id == mess.SenderID) ? listUser.find((e) => e._id == mess.SenderID).userName : "",
                        ava: 'a',
                        mess: 'Bạn đã nhận được 1 vị trí ',
                        type: 'text',
                        idSender: mess.SenderID,
                        mask: 1
                      },
                      headers: { "Content-Type": "multipart/form-data" }
                    }).catch((e) => {
                      console.log(e)
                    })
                  }
                  else if (req.body.MessageType == "sendProfile") {
                    axios({
                      method: "post",
                      url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                      data: {
                        IdReceiver: JSON.stringify(listUserOffline),
                        conversationId: ConversationID,
                        sendername: listUser.find((e) => e._id == mess.SenderID) ? listUser.find((e) => e._id == mess.SenderID).userName : "",
                        ava: 'a',
                        mess: 'Bạn đã nhận được 1 thẻ liên hệ',
                        type: 'text',
                        idSender: mess.SenderID,
                        mask: 1
                      },
                      headers: { "Content-Type": "multipart/form-data" }
                    }).catch((e) => {
                      console.log(e)
                    })
                  }
                  else {
                    axios({
                      method: "post",
                      url: "http://43.239.223.157:9001/api/V2/Notification/SendNotificationApp",
                      data: {
                        IdReceiver: JSON.stringify(listUserOffline),
                        conversationId: ConversationID,
                        sendername: listUser.find((e) => e._id == mess.SenderID) ? listUser.find((e) => e._id == mess.SenderID).userName : "",
                        ava: 'a',
                        mess: 'Bạn đã nhận được 1 file',
                        type: 'text',
                        idSender: mess.SenderID,
                        mask: 1
                      },
                      headers: { "Content-Type": "multipart/form-data" }
                    }).catch((e) => {
                      console.log(e)
                    })
                  }
                }
              }
            }).catch((e) => { console.log(e) })
          }).catch(function (err) {
            console.log(err);
          });

      }
      else {
        res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
      }
    }
    else {
      res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
    }
  }
  catch (e) {
    console.log(e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

export const SendMessageCv = async (req, res) => {
  try {
    if (req.body.linkImg && req.body.linkPdf && req.body.userId && req.body.senderId && (!isNaN(req.body.userId))) {
      // console.log("sendCv",req.body)
      // tra ve response trc 
      // check pdf de gui tiep 
      let savePdf

      let checkUser = await User.findOne({ _id: Number(req.body.userId) }, { _id: 1 }).lean();
      if (checkUser) {
        res.json({
          data: {
            message: "Gửi thành công",
          },
          error: null
        });
        let saveImg = await downloadFile(req.body.linkImg, 'png');
        if (!saveImg) {
          return res.status(200).json(createError(200, "Không tải được ảnh cv"))
        };
        //console.log("Da luu dc anh",req.body)
        if (req.body.linkPdf.includes('http://') || req.body.linkPdf.includes('https://')) {
          savePdf = await downloadFile(req.body.linkPdf, 'pdf');
        }
        else {
          savePdf = await convertBase64ToPDF(req.body.linkPdf)
        }
        if (!savePdf) {
          //res.status(200).json(createError(200, "Không tải được pdf cv"));
          console.log('Loi pdf');
          myConsole2.log(req.body.linkPdf, String(new Date()));

          // gui laij dang link neu pdf that bai
          let conversationId = await FCreateNewConversation(Number(req.body.userId), Number(req.body.senderId));
          await axios({
            method: "post",
            url: "http://43.239.223.142:9009/api/message/SendMessage",
            data: {
              ConversationID: conversationId,
              SenderID: Number(req.body.senderId),
              MessageType: "link",
              Message: req.body.linkPdf,
            },
            headers: { "Content-Type": "multipart/form-data" }
          });
          return false;
        };
        //console.log("Da luu pdf",req.body);
        let conversationId = await FCreateNewConversation(Number(req.body.userId), Number(req.body.senderId));
        await axios({
          method: "post",
          url: "http://43.239.223.142:9009/api/message/SendMessage",
          data: {
            ConversationID: conversationId,
            SenderID: Number(req.body.senderId),
            MessageType: "sendCv",
            Message: req.body.Title,
            File: JSON.stringify([
              {
                TypeFile: "sendFile",
                FullName: saveImg,
                ImageSource: null,
                FileSizeInByte: "10 KB",
                Height: 0,
                Width: 0,
                SizeFile: 10,
                NameDisplay: saveImg
              },
              {
                TypeFile: "sendFile",
                FullName: savePdf,
                ImageSource: null,
                FileSizeInByte: "20KB",
                Height: 0,
                Width: 0,
                SizeFile: 10,
                NameDisplay: savePdf
              }
            ])
          },
          headers: { "Content-Type": "multipart/form-data" }
        });
        //console.log("Da gui tin nhan",conversationId,req.body)
        let checkImg = await axios.get(req.body.linkImg);
        if (String(checkImg.data).includes('404')) {
          res.status(404).json(createError(404, "Error imgLink"));
          return false;
        }
        return true;
      }
      else {
        res.status(201).json(createError(201, "Can not find user"));
        console.log("Can not find user sendCv");
        return false;
      }
    }
    else {
      ///res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
      console.log("Thông tin truyền lên không đầy đủ")
      return false;
    }

  } catch (err) {
    console.log("sendCv", err)
    //res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    return false;
  }
}

//xoa nhiều tin nhắn (trong base)
export const DeleteListMessage = async (req, res) => {
  try {
    const conversationID = Number(req.body.ConversationID) || "";
    const messageId = req.body.ListMessageID || "";
    let listId = [];
    if (!req.body.ListMessageID.includes("[")) {
      listId = req.body.ListMessageID;
    } else {
      let string = String(req.body.ListMessageID).replace("[", "");
      string = String(string).replace("]", "");
      let list = string.split(",");
      for (let i = 0; i < list.length; i++) {
        if (list[i]) {
          listId.push(list[i]);
        }
      }
    }

    if (!(conversationID && messageId)) {
      return res.send(createError(200, "Thiếu thông tin truyền lên"));
    }
    let listmember = []
    let conv = await Conversation.findOne({ _id: conversationID }, { memberList: 1 })
    for (let i = 0; i < conv.memberList.length; i++) {
      listmember.push(conv.memberList[i].memberId)
    }
    for (let i = 0; i < listId.length; i++) {
      let exCons = await Conversation.findByIdAndUpdate({ _id: conversationID, messageList: { $elemMatch: { _id: { $eq: listId[i] } } } },
        { $pull: { messageList: { _id: listId[i] } } })
      const messageInfo = {
        ConversationID: conversationID,
        MessageID: listId[i],
      }
      socket.emit('DeleteMessage', messageInfo, listmember)
    }
    console.log(listmember)
    // if (!exCons) return res.send(createError(200, "Tin nhắn không tồn tại"));
    const existConversation = await Conversation.findById(conversationID)
    if (existConversation.messageList.length > 0) {
      existConversation.timeLastMessage =
        existConversation.messageList[
          existConversation.messageList.length - 1
        ].createAt;
    }
    await existConversation.save();
    const data = {
      result: true,
      message: "Xoá nhắn thành công",
    };
    return res.send({ data, error: null });
  } catch (err) {
    console.log(err);
    if (err) return res.send(createError(200, err.message));
  }
};

export const DeleteAllMessageConversation = async (req, res) => {
  try {
    const conversationId = Number(req.body.conversationId);
    const senderId = Number(req.body.senderId);
    const existConversation = await Conversation.findOne({
      _id: conversationId,
    }).select({
      memberList: 1,
    });
    if (existConversation && (existConversation.memberList.find((e) => Number(e.memberId) === senderId))) {
      Conversation.updateOne(
        { _id: conversationId },
        { $set: { messageList: [] } }
      ).catch((e) => {
        console.log("Error DeleteAllMessageConversation")
      })
    }
    else {
      return res.send(createError(200, "Delete Message In Conersation failed"));
    }
    let data = {
      result: true,
      message: "Xóa cuộc trò chuyện thành công",
    };
    return res.status(200).send({ data, error: null });
  } catch (err) {
    console.log(err);
    if (err) return res.send(createError(200, err.message));
  }
};


export const SendMessageImportant = async (req, res) => {
  try {
    let count = 0
    const sendmess = () => {
      count = count + 1
      FSendMessage({
        body: {
          ...req.body
        }
      }).catch((e) => {
        console.log("Error sendmess SendMessageImportant", e)
      })
      if (count == 4) {
        clearInterval(myInterval)
      }
    }
    FSendMessage({
      body: {
        ...req.body
      }
    }).catch((e) => {
      console.log("Error sendmess SendMessageImportant", e)
    })
    const myInterval = setInterval(sendmess, 1000 * 60 * 2)
  } catch (err) {
    console.log(err);
    if (err) return res.send(createError(200, err.message));
  }
}


//Doc tin nhan
export const ClickMessageNotification = async (req, res) => {
  try {
    if (req.body.token) {
      let check = await checkToken(req.body.token);
      if (check && check.status && (check.userId == req.body.senderId)) {
        console.log("Token hop le, ReadMessage")
      }
      else {
        return res.status(404).json(createError(404, "Invalid token"));
      }
    }
    const data = {
      result: true,
      message: "Đánh dấu tin nhắn đã đọc thành công thành công",
    };
    res.send({ data, error: null });

    const messageId = req.body.messageId;
    const conversationId = Number(req.body.conversationId);
    Conversation.updateOne(
      { _id: conversationId, "messageList._id": messageId },
      {
        $set: {
          "messageList.$.isClicked": 1,
        }
      }
    ).catch((e) => { console.log("ClickMessageNotification"); return false })
    return true
  } catch (err) {
    console.log("ReadMessage", err)
    return false;
  }
};

export const SendListMessage = async (req, res) => {
  try {
    console.log(req.body.listMessage)
    let listMessage = JSON.parse(req.body.listMessage);
    const time = ((new Date).getTime() * 10000) + 621355968000000000 + 8
    for (let i = 0; i < listMessage.length; i++) {
      console.log(i)
      listMessage[i].MessageID = `${time + i * 1000}_${listMessage[i].SenderID}`
      if (listMessage[i].File) {
        listMessage[i].File = JSON.stringify(listMessage[i].File)
      }
      FSendMessage({
        body: listMessage[i]
      }).catch((e) => {
        console.log("error when send profile internal message", e)
      })
    }
    res.json({
      data: {
        result: true,
        message: 'Gửi tin nhắn thành công'
      },
      error: null
    })
  } catch (err) {
    console.log(err);
    if (err) return res.send(createError(200, err.message));
  }
}
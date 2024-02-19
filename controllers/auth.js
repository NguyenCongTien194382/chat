import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import Contact from "../models/Contact.js";
import Verify from "../models/Verify.js";
import { urlImgHost } from '../utils/config.js'
import { fUsers } from "../functions/fModels/fUsers.js";
import { UsersModelExtra } from "../functions/fModels/fUsers.js";
import { InsertNewUser } from "../functions/handleModels/InsertNewUser.js";
import { InsertNewUserExtra } from "../functions/fTools/fUsers.js";
import { UpdateInfoUser } from "../functions/fTools/fUsers.js";
import { GetUserByID365 } from "../functions/fTools/fUsers.js";
import { downloadImage } from "../functions/fTools/Download.js";
import { createError } from "../utils/error.js";
import multer from 'multer';
import fs from 'fs';
import path from 'path';

import axios from 'axios'
import md5 from 'md5';
import qs from 'qs'
import io from 'socket.io-client';
import geoip from 'geoip-lite';
import jwt from "jsonwebtoken";
import { tokenPassword } from '../utils/checkToken.js'
let urlImg = `${urlImgHost()}avatarUser`;

const socket2 = io.connect('wss://socket.timviec365.vn', {
  secure: true,
  enabledTransports: ["wss"],
  transports: ['websocket', 'polling'],
});

function isNullOrWhitespace(input) {
  return !input || !input.trim();
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}

function removeVietnameseTones(str) {
  if (str && (str.trim()) && (str.trim() != "")) {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    str = str.replace(/\u0300|\u0301|\u0305|\u0309|\u0323/g, "");
    str = str.replace(/\u02C6|\u0306|\u031B/g, "");
    str = str.replace(/ + /g, " ");
    str = str.trim();

    str = str.replace(/!|%|\^|\*|\(|\)|\+|\=|\<|\>|\?|\/|,|\:|\;|\'|\"|\&|\#|\[|\]|~|\$|_|`|-|{|}|\||\\/g, " ");
    return str;
  }
  else {
    return ""
  }
}

const CheckVerify = async (emailPhone) => {
  try {
    let checkData = await Verify.find({ EmailPhone: emailPhone }).lean();
    if (checkData) {
      if (checkData.length) {
        return Number(checkData[0].Permission);
      }
      else {
        return 0;
      }
    }
  }
  catch (e) {
    return 0;
    console.log(e)
  }
}

const VerifyUser = async (emailPhone, type365) => {
  try {
    let checkData = await Verify.find({ EmailPhone: emailPhone }).lean();
    if (checkData) {
      if (checkData.length) {
        Verify.updateMany({ EmailPhone: emailPhone }, { $set: { Permission: 1 } }).catch((e) => { console.log(e) });
      }
      else {
        let newVerify = new Verify({
          EmailPhone: emailPhone,
          Type: (!isNaN(type365)) ? Number(type365) : 0,
          Permission: 1,
        });
        newVerify.save().catch((e) => { console.log(e) });
        if (Number(type365 != 0)) {
          let newVerify2 = new Verify({
            EmailPhone: emailPhone,
            Type: 0,
            Permission: 1,
          });
          newVerify2.save().catch((e) => { console.log(e) });
        }
      }
    }
  }
  catch (e) {
    console.log(e)
  }
}

export const luutrucanhan = async (userId) => {
  let userCheck = await User.findOne({ _id: userId })
  if (userCheck) {
    let checkContact = await Contact.find({
      $or: [
        { userFist: userId, userSecond: 1216972 },
        { userFist: 1216972, userSecond: userId }
      ]
    }).limit(1).lean();

    if (!checkContact.length) {
      let newContact = new Contact({
        userFist: 1216972,
        userSecond: userId
      })
      newContact.save().catch((e) => {
        console.log(e);
      });
    }
  }
}

export const checkNewUser = async (userId) => {
  try {
    console.log("checkNewUser", userId)
    let userCheckExist = await User.find({ _id: userId });
    let flag = true;
    if (userCheckExist && userCheckExist.length > 0 && flag) {
      let checkContact = await Contact.find({
        $or: [
          { userFist: userId, userSecond: 56387 },
          { userFist: 56387, userSecond: userId }
        ]
      }).limit(1).lean();

      if (!checkContact.length) {
        let newContact = new Contact({
          userFist: 56387,
          userSecond: userId
        })
        newContact.save().catch((e) => {
          console.log(e);
        });
      }
      let content = 'Chào bạn, bạn đăng ký tài khoản có gặp khó khăn gì không ạ? M xin được hỗ trợ ạ?\n*** Ưu đãi đặc quyền Chat365:\n- Chiết khấu 4-10% khi mua thẻ cào điện thoại trên Chat365.\n- Ví dụ: Mua Thẻ cào điện thoại 100.000 VND chỉ còn 90.000 VND đến 96.000 VND.\n- Nhắn tin với tôi để mua thẻ.';
      if (userCheckExist.length) {
        if ((userCheckExist[0].fromWeb == "timviec365")) {
          if (userCheckExist[0].type365 == 1) {
            flag = false;
          }
        };
        if ((userCheckExist[0].fromWeb == "timviec365")) {
          if (userCheckExist[0].type365 == 0) {
            content = 'Ứng viên tạo cv xong cần: Tải app chat365 về và đăng nhập tài khoản ứng viên vào chat365 mục “tài khoản cá nhân”; vào chat365 sau đăng nhập sẽ có tài khoản “Công ty Cổ phần thanh toán Hưng Hà” gửi CV bằng file ảnh hoặc file PDF cho ứng viên trên chat365; tại đây ứng viên có thể tải CV dạng ảnh hoặc dạng PDF về máy hoặc chia sẻ sang các mạng xã hội khác.\n*** Ưu đãi đặc quyền Chat365:\n- Chiết khấu 4-10% khi mua thẻ cào điện thoại trên Chat365.\n- Ví dụ: Mua Thẻ cào điện thoại 100.000 VND chỉ còn 90.000 VND đến 96.000 VND.\n- Nhắn tin với tôi để mua thẻ.'
          }
        }
        if (flag) {
          console.log("flag thoa man")
          const existConversation = await Conversation.findOne({
            $and: [
              { "typeGroup": "liveChatV2" },
              { "memberList.memberId": { $eq: userId } },
              { "memberList.memberId": { $eq: 56387 } },
              { "messageList.message": { $eq: content } }
            ],
            isGroup: 1,
          }).lean();
          if ((!existConversation)) {
            console.log("Khong ton tai")
            let today = new Date();
            let pastday = new Date();
            pastday.setDate(today.getDate() - 15);
            const bigestId = (
              await Conversation.find().sort({ _id: -1 }).select("_id").limit(1).lean()
            )[0]._id;
            const newConversation = await Conversation.create({
              _id: bigestId + 1,
              isGroup: 1,
              typeGroup: "liveChatV2",
              memberList: [
                {
                  memberId: userId,
                  notification: 1,
                  conversationName: `Hỗ trợ khách hàng lần đầu đăng nhập chat365-${userCheckExist[0]._id}`,
                  unReader: 1,
                  liveChat: {
                    clientId: userId,
                    fromConversation: 275601,
                    fromWeb: userCheckExist[0].fromWeb
                  }
                },
                {
                  memberId: 56387,
                  unReader: 1,
                  conversationName: `Hỗ trợ khách hàng lần đầu đăng nhập chat365-${userCheckExist[0]._id}`,
                  notification: 1,
                }
              ],
              messageList: [],
              browseMemberList: [],
              timeLastMessage: new Date(pastday),
              timeLastChange: new Date(pastday)
            });
            let arrayMessage = [{
              _id: `${((new Date).getTime() * 10000) + 621355968000000000 + 8}_${56387}`,
              displayMessage: 0,
              senderId: 56387,
              messageType: "text",
              message: content,
              quoteMessage: "",
              messageQuote: "",
              createAt: new Date(pastday),
              isEdited: 0,
              infoLink: null,
              listFile: [],
              emotion: { Emotion1: "", Emotion2: "", Emotion3: "", Emotion4: "", Emotion5: "", Emotion6: "", Emotion7: "", Emotion8: "", },
              deleteTime: 0,
              deleteType: 0,
              deleteDate: new Date("0001-01-01T00:00:00.000+00:00"),
              notiClicked: 0,
              infoSupport: null,
              liveChat: null,
            }];
            await Conversation.findOneAndUpdate(
              { _id: newConversation._id },
              {
                $push:
                {
                  messageList:
                  {
                    $each: arrayMessage
                  }
                }
              }
            );
          }
        }
        else {
          console.log("flag khong thoa man")
        }
      }
    }
  }
  catch (e) {
    console.log("checkNewUser", e)
  }
}

export const takedatatoverifylogin = async (req, res, next) => {
  try {
    let userId = Number(req.params.userId);
    let temp2 = 0
    let randomArray = [];
    while (temp2 < 3) {
      let t = getRandomInt(1, 7);
      if (!randomArray.includes(t)) {
        randomArray.push(t);
        temp2++;
      }
    }
    randomArray.sort((a, b) => {
      if (a < b) {
        return -1;// giữ nguyên 
      }
      else if (a > b) {
        return 1;// đổi
      }
      return 0;
    })
    // console.log(randomArray);

    // lấy ra userId của 3 người bạn 
    let result1 = await Contact.find({
      $or: [
        { userFist: userId },
        { userSecond: userId }
      ]
    }).limit(3);
    let arrayUserId = [];
    if (result1) {
      for (let i = 0; i < result1.length; i++) {
        arrayUserId.push(result1[i].userFist);
        arrayUserId.push(result1[i].userSecond)
      }
    }
    arrayUserId = arrayUserId.filter(e => e != userId);

    let listAccountFinal = [];
    let listAccount = await User.find({ _id: { $in: arrayUserId } }, { userName: 1, avatarUser: 1, lastActive: 1, isOnline: 1 }).sort({ isOnline: 1, lastActive: -1 });

    // xác định khoảng lấy dữ liệu random 
    let count = await User.find({ _id: { $ne: 0 } }, { _id: 1 }).sort({ _id: -1 }).limit(1);
    let UserIdmax = 40000;
    if (count) {
      if (count.length == 1) {
        UserIdmax = count[0]._id;
      }
    }

    // lấy 6 tài khoản bất kỳ 
    let temp = 0;
    let tempArray = [];
    while (temp < 6) {
      let userId = getRandomInt(1, UserIdmax);
      let user = await User.find({ _id: userId }, { userName: 1, avatarUser: 1, lastActive: 1, isOnline: 1 }).limit(1);
      if (user) {
        if (user.length > 0) {
          tempArray.push(user[0]);
          temp++;
        }
      }
    }

    // trộn danh sách người bạn với danh sách người bất kỳ 
    let a = 0; // thứ tự mảng trung gian 
    let b = 0; // thứ tự đếm của mảng thứ tự kết quả 
    let c = randomArray[b];
    while (b < 3) {
      while (a < c) {
        listAccountFinal.push(tempArray[a]);
        a++;
      }
      listAccountFinal.push(listAccount[b]);
      b++;
      c = randomArray[b]
    }
    if (listAccountFinal.length < 9) {
      for (let i = a; i < tempArray.length; i++) {
        listAccountFinal.push(tempArray[i]);
      }
    }
    listAccountFinal = listAccountFinal.filter(e => e != undefined)
    if (result1) {
      if (listAccount) {
        let result = [];
        for (let i = 0; i < listAccountFinal.length; i++) {
          let a = {};
          a._id = listAccountFinal[i]._id;
          a.userName = listAccountFinal[i].userName;
          if (listAccountFinal[i].avatarUser != "") {
            a.avatarUser = `${urlImgHost()}avatarUser/${listAccountFinal[i]._id}/${listAccountFinal[i].avatarUser}`;
          }
          else {
            a.avatarUser = `${urlImgHost()}avatar/${removeVietnameseTones(listAccountFinal[i].userName[0])}_${getRandomInt(1, 4)}.png`
          }

          a.listAccountFinal = listAccountFinal[i].lastActive;
          a.isOnline = listAccountFinal[i].isOnline;
          result.push(a);
        }
        res.status(200).json({
          data: {
            result: true,
            message: "Lấy thông tin thành công",
            listAccount: result,
            friendlist: listAccount
          },
          error: null
        });
      }
    }
  }
  catch (err) {
    console.log("takedatatoverifylogin", err);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}


export const takedatatoverifyloginV2 = async (req, res, next) => {
  try {
    const listFriendId = []
    const listAccount = []
    const userId = Number(req.params.userId)
    let currentTime = new Date()
    currentTime.setDate(currentTime.getDate() - 3)
    const lastTime = `${currentTime.getFullYear()}-${(currentTime.getMonth() + 1).toString().padStart(2, '0')}-${currentTime.getDate().toString().padStart(2, '0')}`
    let countConv = await Conversation.count({
      "memberList.memberId": userId,
      isGroup: 0,
      "messageList.0": {
        $exists: true,
      },
    })
    if (countConv < 10) {
      return res.status(200).json({
        data: {
          result: true,
          message: "Lấy thông tin thành công",
          listAccount: [],
          friendlist: []
        },
        error: null
      })
    }
    let conv = await Conversation.aggregate([
      {
        $match: {
          "memberList.memberId": userId,
          isGroup: 0,
          "messageList.0": {
            $exists: true,
          },
        },
      },
      {
        $project: {
          memberList: 1,
          sizeListMes: {
            $size: "$messageList",
          },
          timeLastMessage: {
            $dateToString: {
              date: "$timeLastMessage",
              timezone: "+07:00",
              format: "%G-%m-%d",
            },
          },
        },
      },
      {
        $match: {
          timeLastMessage: {
            $gte: lastTime,
          },
        },
      },
      {
        $sort: {
          sizeListMes: -1,
        },
      },
      {
        $limit: 3,
      },
    ])
    if (conv.length !== 3) {
      const conv1 = await Conversation.aggregate([
        {
          $match: {
            "memberList.memberId": userId,
            isGroup: 0,
            "messageList.0": {
              $exists: true,
            },
          },
        },
        {
          $project: {
            memberList: 1,
            sizeListMes: {
              $size: "$messageList",
            },
            timeLastMessage: {
              $dateToString: {
                date: "$timeLastMessage",
                timezone: "+07:00",
                format: "%G-%m-%d",
              },
            },
          },
        },
        {
          $sort: {
            timeLastMessage: -1,
          },
        },
        {
          $limit: 3,
        },
        {
          $skip: 2,
        },
      ])
      conv = await Conversation.aggregate([
        {
          $match: {
            "memberList.memberId": userId,
            isGroup: 0,
            "messageList.0": {
              $exists: true,
            },
          },
        },
        {
          $project: {
            memberList: 1,
            sizeListMes: {
              $size: "$messageList",
            },
            timeLastMessage: {
              $dateToString: {
                date: "$timeLastMessage",
                timezone: "+07:00",
                format: "%G-%m-%d",
              },
            },
          },
        },
        {
          $match: {
            timeLastMessage: {
              $gte: conv1[0].timeLastMessage,
            },
          },
        },
        {
          $sort: {
            sizeListMes: -1,
          },
        },
        {
          $limit: 3,
        },
      ])
    }
    conv.forEach(e => {
      for (let i = 0; i < e.memberList.length; i++) {
        if (e.memberList[i].memberId && e.memberList[i].memberId !== userId) {
          listFriendId.push(e.memberList[i].memberId)
        }
      }
    })
    const count = 10 - listFriendId.length
    const friendlist = await User.find({ _id: { $in: listFriendId } }, { userName: 1, avatarUser: 1, lastActive: 1, isOnline: 1 }).limit(3)
    for (let i = 0; i < friendlist.length; i++) {
      if (friendlist[i].avatarUser != "") {
        friendlist[i].avatarUser = `${urlImgHost()}avatarUser/${friendlist[i]._id}/${friendlist[i].avatarUser}`;
      }
      else {
        friendlist[i].avatarUser = `${urlImgHost()}avatar/${removeVietnameseTones(friendlist[i].userName[0])}_${getRandomInt(1, 4)}.png`
      }
      listAccount.push({
        "_id": friendlist[i]._id,
        "userName": friendlist[i].userName,
        "avatarUser": friendlist[i].avatarUser,
        "listAccountFinal": friendlist[i].lastActive,
        "isOnline": friendlist[i].isOnline
      })
    }

    const userIds = await User.aggregate([
      {
        $match: { _id: { $nin: listFriendId } }
      },
      {
        $project: { _id: 1 }
      },
      {
        $limit: 10000
      }
    ]);

    const randomUserIds = [];
    const totalUsers = userIds.length;

    while (randomUserIds.length < count) {
      const randomIndex = Math.floor(Math.random() * totalUsers);
      const userId = userIds[randomIndex]._id;

      if (!randomUserIds.includes(userId) && !listFriendId.includes(userId)) {
        randomUserIds.push(userId);
      }
    }

    const listUser = await User.find(
      { _id: { $in: randomUserIds } },
      {
        _id: 1,
        userName: 1,
        avatarUser: 1,
        lastActive: 1,
        isOnline: 1
      }
    );

    for (let i = 0; i < listUser.length; i++) {
      if (listUser[i].avatarUser != "") {
        listUser[i].avatarUser = `${urlImgHost()}avatarUser/${listUser[i]._id}/${listUser[i].avatarUser}`;
      }
      else {
        listUser[i].avatarUser = `${urlImgHost()}avatar/${removeVietnameseTones(listUser[i].userName[0])}_${getRandomInt(1, 4)}.png`
      }
      listAccount.push({
        "_id": listUser[i]._id,
        "userName": listUser[i].userName,
        "avatarUser": listUser[i].avatarUser,
        "listAccountFinal": listUser[i].lastActive,
        "isOnline": listUser[i].isOnline
      })
    }
    listAccount.sort(() => Math.random() - 0.5)
    res.status(200).json({
      data: {
        result: true,
        message: "Lấy thông tin thành công",
        listAccount: listAccount,
        friendlist: friendlist
      },
      error: null
    })
  }
  catch (err) {
    console.log("takedatatoverifyloginV2", err);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}




export const confirmlogin = async (req, res, next) => {
  try {
    console.log(req.body);
    let ipAddress = req.socket.remoteAddress;
    let geo = geoip.lookup(ipAddress);
    let latitude = 0;
    let longtitude = 0;
    if (geo && geo.ll) {
      latitude = geo.ll[0];
      longtitude = geo.ll[1];
    }
    let info = req.body;
    let listUserId = [];
    if (info.listUserId.includes("[")) {
      info.listUserId = info.listUserId.replace("[", "");
      info.listUserId = info.listUserId.replace("]", "");
      info.listUserId = info.listUserId.replace(`"`, "");
      info.listUserId = info.listUserId.replace(`"`, "");
      info.listUserId = info.listUserId.replace(`"`, "");
      info.listUserId = info.listUserId.replace(`"`, "");
      info.listUserId = info.listUserId.replace(`"`, "");
      info.listUserId = info.listUserId.replace(`"`, "");
      info.listUserId = info.listUserId.replace(`"`, "");

      info.listUserId = info.listUserId.split(",");
      for (let i = 0; i < info.listUserId.length; i++) {
        if (info.listUserId[i].trim() != '' && (!isNaN(info.listUserId[i]))) {
          listUserId.push(Number(info.listUserId[i]));
        }
      };
    }
    if (info.listUserId.length > listUserId.length) {
      return res.status(200).json(createError(200, "Invalid Input"));
    }
    if (req.body.countReturned) {
      if (Number(req.body.countReturned) > listUserId.length) {
        return res.status(200).json(createError(200, "Invalid count choice"));
      }
    }

    if (req.body.myId && req.body.IdDevice && req.body.NameDevice && req.body.listUserId) {
      let check = true;
      if (listUserId.length == 3) {
        let result1 = await Contact.find({
          $or: [
            { userFist: Number(info.myId), userSecond: Number(listUserId[0]) },
            { userSecond: Number(info.myId), userFist: Number(listUserId[0]) },
            { userFist: Number(info.myId), userSecond: Number(listUserId[1]) },
            { userSecond: Number(info.myId), userFist: Number(listUserId[1]) },
            { userFist: Number(info.myId), userSecond: Number(listUserId[2]) },
            { userSecond: Number(info.myId), userFist: Number(listUserId[2]) },
          ]
        });

        for (let i = 0; i < listUserId.length; i++) {
          if (!result1.find((e) => e.userFist == listUserId[i])) {
            if (!result1.find((e) => e.userSecond == listUserId[i])) {
              check = false;
            }
          }
        }
        if (result1.length < 3) {
          check = false;
        }
      }
      else if (listUserId.length == 2) {
        let result1 = await Contact.find({
          $or: [
            { userFist: Number(info.myId), userSecond: Number(listUserId[0]) },
            { userSecond: Number(info.myId), userFist: Number(listUserId[0]) },
            { userFist: Number(info.myId), userSecond: Number(listUserId[1]) },
            { userSecond: Number(info.myId), userFist: Number(listUserId[1]) },
          ]
        });
        for (let i = 0; i < listUserId.length; i++) {
          if (!result1.find((e) => e.userFist == listUserId[i])) {
            if (!result1.find((e) => e.userSecond == listUserId[i])) {
              check = false;
            }
          }
        }
        if (result1.length < 2) {
          check = false;
        }
      }
      else if (listUserId.length == 1) {
        let result1 = await Contact.find({
          $or: [
            { userFist: Number(info.myId), userSecond: Number(listUserId[0]) },
            { userSecond: Number(info.myId), userFist: Number(listUserId[0]) },
          ]
        });
        for (let i = 0; i < listUserId.length; i++) {
          if (!result1.find((e) => e.userFist == listUserId[i])) {
            if (!result1.find((e) => e.userSecond == listUserId[i])) {
              check = false;
            }
          }
        }
        if (result1.length < 1) {
          check = false;
        }
      }
      else {
        check = false;
      }
      if (check) {
        User.updateOne(
          {
            _id: Number(info.myId),
            HistoryAccess: { $elemMatch: { IdDevice: { $eq: String(info.IdDevice) } } }
          },
          {
            $set: {
              "HistoryAccess.$.AccessPermision": true,
              "HistoryAccess.$.IpAddress": String(ipAddress),
              latitude: Number(latitude),
              longtitude: Number(longtitude),
            }
          }
        ).catch((e) => {
          console.log(e); s
        })

        let createConv = await axios({
          method: "post",
          url: "http://43.239.223.142:9000/api/conversations/CreateNewConversation",
          data: {
            userId: 114803,
            contactId: Number(info.myId)
          },
          headers: { "Content-Type": "multipart/form-data" }
        });
        if (createConv && createConv.data && createConv.data.data && createConv.data.data.conversationId) {
          axios({
            method: "post",
            url: "http://43.239.223.142:9000/api/message/SendMessage",
            data: {
              MessageID: '',
              ConversationID: createConv.data.data.conversationId,
              SenderID: 114803,
              MessageType: "text",
              Message: `Thiết bị ${String(req.body.NameDevice).split("-")[0]} đã đăng nhập tài khoản của bạn vào lúc ${new Date().getHours()}:${new Date().getMinutes()} ${new Date().getFullYear()}/${new Date().getMonth() + 1}/${new Date().getDate()}`,
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
          }).catch((e) => { console.log(e) });
        }
        res.json({
          data: {
            result: true,
            status: true,
          },
          error: null
        });
      }
      else {
        res.status(200).json(createError(200, "Danh sách bạn bè không chính xác"));
      }
    }
    else {
      res.status(200).json(createError(200, "Thiếu thông tin truyền lên"));
    }
  }
  catch (e) {
    console.log("confirmlogin", e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

export const AcceptLogin = async (req, res, next) => {
  try {
    let ipAddress = req.socket.remoteAddress;
    let geo = geoip.lookup(ipAddress);
    let latitude = 0;
    let longtitude = 0;
    if (geo && geo.ll) {
      latitude = geo.ll[0];
      longtitude = geo.ll[1];
    }
    if (req.body.UserId && req.body.IdDevice && req.body.NameDevice) {
      User.updateOne(
        {
          _id: Number(req.body.UserId),
          HistoryAccess: { $elemMatch: { IdDevice: { $eq: String(req.body.IdDevice) } } }
        },
        {
          $set: {
            "HistoryAccess.$.AccessPermision": true,
            "HistoryAccess.$.IpAddress": String(ipAddress),
            latitude: Number(latitude),
            longtitude: Number(longtitude),
          }
        }
      ).catch((e) => {
        console.log(e);
      })
      let createConv = await axios({
        method: "post",
        url: "http://43.239.223.142:9000/api/conversations/CreateNewConversation",
        data: {
          userId: 114803,
          contactId: Number(req.body.UserId)
        },
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (createConv && createConv.data && createConv.data.data && createConv.data.data.conversationId) {
        axios({
          method: "post",
          url: "http://43.239.223.142:9000/api/message/SendMessage",
          data: {
            MessageID: '',
            ConversationID: createConv.data.data.conversationId,
            SenderID: 114803,
            MessageType: "text",
            Message: `Thiết bị ${String(req.body.NameDevice).split("-")[0]} đã đăng nhập tài khoản của bạn vào lúc ${new Date().getHours()}:${new Date().getMinutes()} ${new Date().getFullYear()}/${new Date().getMonth() + 1}/${new Date().getDate()}`,
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
        }).catch((e) => { console.log(e) });
      }
      res.json({
        data: {
          result: true,
          status: true,
        },
        error: null
      });
    }
    else {
      res.status(200).json(createError(200, "Thiếu thông tin truyền lên"));
    }
  }
  catch (e) {
    console.log("AcceptLogin", e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

export const confirmotp = async (req, res, next) => {
  try {
    if (req.body.myId && (!isNaN(req.body.myId)) && req.body.IdDevice && req.body.NameDevice) {
      let check = true;
      let ipAddress = req.socket.remoteAddress;
      let geo = geoip.lookup(ipAddress);
      let latitude = 0;
      let longtitude = 0;
      if (geo && geo.ll) {
        latitude = geo.ll[0];
        longtitude = geo.ll[1];
      }
      if (check) {
        User.updateOne(
          {
            _id: Number(req.body.myId),
            HistoryAccess: { $elemMatch: { IdDevice: { $eq: String(req.body.IdDevice) } } }
          },
          {
            $set: {
              "HistoryAccess.$.AccessPermision": true,
              "HistoryAccess.$.IpAddress": String(ipAddress),
              latitude: latitude,
              longtitude: longtitude,
            }
          }
        ).catch((e) => {
          console.log(e)
        })
        let user = await User.find({ _id: Number(req.body.myId) }).limit(1);
        if (user) {
          if (user.length) {
            res.json({
              data: {
                result: true,
                status: true,
                user_info: user[0]
              },
              error: null
            });
          }
        }
      }
      else {
        res.status(200).json(createError(200, "Danh sách bạn bè không chính xác"));
      }
    }
    else {
      res.status(200).json(createError(200, "Thiếu thông tin truyền lên"));
    }
  }
  catch (e) {
    console.log("confirmotp", e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

export const refreshtoken = async (req, res, next) => {
  try {
    if (req.body.refreshtoken) {
      let dataencode = await jwt.verify(req.body.refreshtoken, tokenPassword());
      let time = new Date();
      let token = jwt.sign(
        { _id: dataencode._id, timeExpried: time.setDate(time.getDate() + 3) },
        tokenPassword()
      );
      return res.json({
        data: {
          result: true,
          token
        },
        error: null
      })

    }
    else {
      res.status(200).json(createError(200, "Thiếu thông tin truyền lên"));
    }
  }
  catch (e) {
    console.log("confirmotp", e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

export const takedatatoverifyloginV3 = async (req, res, next) => {
  try {
    const listFriendId = []
    const listAccount = []
    const userId = Number(req.params.userId)
    let currentTime = new Date()
    currentTime.setDate(currentTime.getDate() - 3)
    const lastTime = `${currentTime.getFullYear()}-${(currentTime.getMonth() + 1).toString().padStart(2, '0')}-${currentTime.getDate().toString().padStart(2, '0')}`
    let countConv = await Conversation.count({
      "memberList.memberId": userId,
      isGroup: 0,
      "messageList.0": {
        $exists: true,
      },
    })
    if (countConv < 10) {
      return res.status(200).json({
        data: {
          result: true,
          message: "Lấy thông tin thành công",
          listAccount: [],
          friendlist: []
        },
        error: null
      })
    }
    let conv = await Conversation.aggregate([
      {
        $match: {
          "memberList.memberId": userId,
          isGroup: 0,
          "messageList.0": {
            $exists: true,
          },
        },
      },
      {
        $project: {
          memberList: 1,
          sizeListMes: {
            $size: "$messageList",
          },
          timeLastMessage: {
            $dateToString: {
              date: "$timeLastMessage",
              timezone: "+07:00",
              format: "%G-%m-%d",
            },
          },
        },
      },
      {
        $match: {
          timeLastMessage: {
            $gte: lastTime,
          },
        },
      },
      {
        $sort: {
          sizeListMes: -1,
        },
      },
      {
        $limit: 3,
      },
    ])
    if (conv.length !== 3) {
      const conv1 = await Conversation.aggregate([
        {
          $match: {
            "memberList.memberId": userId,
            isGroup: 0,
            "messageList.0": {
              $exists: true,
            },
          },
        },
        {
          $project: {
            memberList: 1,
            sizeListMes: {
              $size: "$messageList",
            },
            timeLastMessage: {
              $dateToString: {
                date: "$timeLastMessage",
                timezone: "+07:00",
                format: "%G-%m-%d",
              },
            },
          },
        },
        {
          $sort: {
            timeLastMessage: -1,
          },
        },
        {
          $limit: 3,
        },
        {
          $skip: 2,
        },
      ])
      conv = await Conversation.aggregate([
        {
          $match: {
            "memberList.memberId": userId,
            isGroup: 0,
            "messageList.0": {
              $exists: true,
            },
          },
        },
        {
          $project: {
            memberList: 1,
            sizeListMes: {
              $size: "$messageList",
            },
            timeLastMessage: {
              $dateToString: {
                date: "$timeLastMessage",
                timezone: "+07:00",
                format: "%G-%m-%d",
              },
            },
          },
        },
        {
          $match: {
            timeLastMessage: {
              $gte: conv1[0].timeLastMessage,
            },
          },
        },
        {
          $sort: {
            sizeListMes: -1,
          },
        },
        {
          $limit: 3,
        },
      ])
    }
    conv.forEach(e => {
      for (let i = 0; i < e.memberList.length; i++) {
        if (e.memberList[i].memberId && e.memberList[i].memberId !== userId) {
          listFriendId.push(e.memberList[i].memberId)
        }
      }
    })
    const count = 10 - listFriendId.length
    const friendlist = await User.find({ _id: { $in: listFriendId } }, { userName: 1, avatarUser: 1, lastActive: 1, isOnline: 1 }).limit(3)
    for (let i = 0; i < friendlist.length; i++) {
      if (friendlist[i].avatarUser != "") {
        friendlist[i].avatarUser = `${urlImgHost()}avatarUser/${friendlist[i]._id}/${friendlist[i].avatarUser}`;
      }
      else {
        friendlist[i].avatarUser = `${urlImgHost()}avatar/${removeVietnameseTones(friendlist[i].userName[0])}_${getRandomInt(1, 4)}.png`
      }
      listAccount.push({
        "_id": friendlist[i]._id,
        "userName": friendlist[i].userName,
        "avatarUser": friendlist[i].avatarUser,
        "listAccountFinal": friendlist[i].lastActive,
        "isOnline": friendlist[i].isOnline
      })
    }

    const userIds = await User.aggregate([
      {
        $match: { _id: { $nin: listFriendId } }
      },
      {
        $project: { _id: 1 }
      },
      {
        $limit: 10000
      }
    ]);

    const randomUserIds = [];
    const totalUsers = userIds.length;

    while (randomUserIds.length < count) {
      const randomIndex = Math.floor(Math.random() * totalUsers);
      const userId = userIds[randomIndex]._id;

      if (!randomUserIds.includes(userId) && !listFriendId.includes(userId)) {
        randomUserIds.push(userId);
      }
    }

    const listUser = await User.find(
      { _id: { $in: randomUserIds } },
      {
        _id: 1,
        userName: 1,
        avatarUser: 1,
        lastActive: 1,
        isOnline: 1
      }
    );

    for (let i = 0; i < listUser.length; i++) {
      if (listUser[i].avatarUser != "") {
        listUser[i].avatarUser = `${urlImgHost()}avatarUser/${listUser[i]._id}/${listUser[i].avatarUser}`;
      }
      else {
        listUser[i].avatarUser = `${urlImgHost()}avatar/${removeVietnameseTones(listUser[i].userName[0])}_${getRandomInt(1, 4)}.png`
      }
      listAccount.push({
        "_id": listUser[i]._id,
        "userName": listUser[i].userName,
        "avatarUser": listUser[i].avatarUser,
        "listAccountFinal": listUser[i].lastActive,
        "isOnline": listUser[i].isOnline
      })
    }
    listAccount.sort(() => Math.random() - 0.5)
    res.status(200).json({
      data: {
        result: true,
        message: "Lấy thông tin thành công",
        listAccount: listAccount,
        friendlist: friendlist
      },
      error: null
    })
  }
  catch (err) {
    console.log("takedatatoverifyloginV2", err);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

export const register = async (req, res, next) => {
  try {

    if (req.body.email && req.body.password && req.body.userName) {
      let finduser = await User.findOne({ email: req.body.email, password: md5(req.body.password) })

      let saveUser
      if (finduser) {
        res.status(200).json(createError(200, "Tài khoản đã tồn tại"));
      } else {
        let userId = await User.findOne().sort({ _id: -1 }).limit(1)
        const max_id = userId ? userId._id : 0

        const insert = new User({
          _id: max_id + 1,
          email: req.body.email,
          password: md5(req.body.password),
          userName: req.body.userName,
          userNameNoVn: removeVietnameseTones(req.body.userName)
        })
        saveUser = await insert.save()
      }

      if (req.file) {
        // Save the uploaded file data to the user's avatar field

        saveUser.avatarUser = req.file.originalname
        await saveUser.save();
      }
      // Tạo token cho người dùng đăng ký thành công
      const token = jwt.sign({ userId: saveUser._id }, 'hung123', {
        expiresIn: '1h', // Token sẽ hết hạn sau 1 giờ
      });
      return res.json({
        data: {
          result: true,
          user: saveUser,
          token: token
        },
        error: null
      })

    } else res.status(200).json(createError(200, "Thiếu thông tin truyền lên"));

  } catch (e) {
    console.log("AcceptLogin", e);
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}

export const login = async (req, res, next) => {
  try {
    if (req.body.email && req.body.password) {

      let email = req.body.email;
      let password = md5(req.body.password);

      let findUser = await User.findOne({ email: email, password: password })
      if (findUser) {
        const token = jwt.sign({ _id: findUser._id }, 'hung123', {
          expiresIn: '1h', // Token sẽ hết hạn sau 1 giờ
        });

        findUser.avatarUser = `http://localhost:9000/avatarUser/${findUser.avatarUser}`
        return res.json({
          data: {
            result: true,
            token: token,
            user_infor: findUser
          },
          error: null
        })
      } else {
        res.status(200).json(createError(200, "Tài khoản hoặc mật khẩu không đúng"));
      }
    } else {
      res.status(200).json(createError(200, "Thiếu thông tin truyền lên"));
    }
  } catch (error) {
    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
  }
}






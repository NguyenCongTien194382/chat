import Personal from "../models/Personal.js";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import { createError } from "../utils/error.js";
import io from 'socket.io-client';
let socket = io('http://localhost:3030');
import multer from 'multer';
import axios from 'axios'
import path from 'path'
import fs from 'fs';
import { RandomString } from "../functions/fTools/fUsers.js";
import Contact from "../models/Contact.js"
import { Duplex } from "stream";
import { info } from "console";
import { ifError } from "assert";
import Privacy from "../models/Privacy.js";
import Diary from "../models/Diary.js";
import mongoose from "mongoose";
import { urlImgHostwf } from '../utils/config.js'
import { urlImgHost } from '../utils/config.js';
import { checkToken } from "../utils/checkToken.js";
import sharp from 'sharp'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from '@ffmpeg-installer/ffmpeg'
import { request } from "http";
ffmpeg.setFfmpegPath(ffmpegPath.path);
const ObjectId = mongoose.Types.ObjectId;

const FileDanger = ['.BAT', '.CHM', '.CMD', '.COM', 'CPL', '.EXE', '.HLP', '.HTA', '.JS', '.JSE', '.LNK', '.MSI', '.PIF', '.REG', '.SCR', '.SCT', '.SHB', '.SHS', '.VB', '.VBE', '.VBS', '.WSC', '.WSF', 'WSH']
    //upload file
const storage = multer.diskStorage({
    destination: function(req, file, cb) {

        if (!fs.existsSync(`C:/Chat365/publish/wwwroot/TestNode/public/personalUpload`)) {
            fs.mkdirSync(`C:/Chat365/publish/wwwroot/TestNode/public/personalUpload`);
        }
        if (!fs.existsSync(`C:/Chat365/publish/wwwroot/TestNode/public/personalUploadSmall`)) {
            fs.mkdirSync(`C:/Chat365/publish/wwwroot/TestNode/public/personalUploadSmall`);
        }
        cb(null, `C:/Chat365/publish/wwwroot/TestNode/public/personalUpload`)
    },
    filename: function(req, file, cb) {
        const fileName = file.originalname.replace(/[ +!@#$%^&*]/g, '')
        cb(null, Date.now() * 10000 + 621355968000000000 + '-' + fileName);
    }
});

export const uploadfiles = multer({
    storage: storage,
})

const ShowPersonal = async(userId, userSeenId) => {
    if (Number(userId) === Number(userSeenId)) return true
    let privacy = await axios({
        method: "post",
        url: "http://43.239.223.142:9000/api/privacy/GetPrivacy",
        data: {
            userId: Number(userId),
        },
        headers: { "Content-Type": "multipart/form-data" }
    })
    if (privacy.data.data) {
        if (privacy.data.data.data.blockPost.includes(Number(userSeenId))) {
            return false //Chặn tất cả bài đăng
        }
        if (privacy.data.data.data.post === '0') {
            const date = new Date(0)
            return date
        } else if (privacy.data.data.data.post === '1') {
            const date = new Date()
            date.setMonth(date.getMonth() - 6)
            return date
        } else if (privacy.data.data.data.post === '2') {
            const date = new Date()
            date.setMonth(date.getMonth() - 1)
            return date
        } else if (privacy.data.data.data.post === '3') {
            const date = new Date()
            date.setDate(date.getDate() - 7)
            return date
        } else {
            const date = new Date(privacy.data.data.data.post)
            return date
        }
    } else {
        return true //Xem tất cả bài đăng
    }
}

const IsFriend = async(userId1, userId2) => {
    let result1 = await Contact.find({
        $or: [
            { userFist: userId1 },
            { userSecond: userId1 }
        ]
    }).limit(3);
    let arrayUserId = [];
    if (result1) {
        for (let i = 0; i < result1.length; i++) {
            arrayUserId.push(result1[i].userFist);
            arrayUserId.push(result1[i].userSecond)
        }
    }
    arrayUserId = arrayUserId.filter(e => e != userId1);
    return arrayUserId.includes(userId2)
}

export const createPost = async(req, res, next) => {
    try {
        if (req.body.token) {
            let check = await checkToken(req.body.token);
            if (check && check.status && (check.userId == req.body.userId)) {
                console.log("Token hop le, createPost")
            } else {
                return res.status(404).json(createError(404, "Invalid token"));
            }
        }
        const formData = {...req.body };

        formData.contentPost = req.body.contentPost;
        formData.userId = req.body.userId;
        formData.raw = req.body.raw;
        formData.link = req.body.link;
        formData.createAt = Date.now();
        formData.imageList = [];
        formData.videoList = [];
        formData.imageListId = []
        formData.videoListId = []
        formData.listTag = req.body.listTag
        formData.IdAlbum = req.body.idAlbum
        
        const type = req.body.type
        let err = false;
        let tag = []

        let findUser = await User.findOne({_id: Number(req.body.userId)},{userName:1, avatarUser:1})

        if(findUser){
            formData.userName = findUser.userName
            formData.avatarUser = findUser.avatarUser;
        }else return res.status(200).json(createError(200, "Không tồn tại user"));

        let findAlbum = await Personal.findOne({ _id: formData.IdAlbum }, { albumName: 1 })
        if (findAlbum) {
            formData.albumName = findAlbum.albumName
        }
        // Thêm ảnh và video vào dữ liệu ( phân biệt ảnh và video riêng)
        let images = [];
        if (req.body.images) {
            if (!req.body.images.includes("[")) {
                images = req.body.images;
            } else {
                let string = String(req.body.images).replace("[", "");
                string = String(string).replace("]", "");
                let list = string.split(",");
                for (let i = 0; i < list.length; i++) {
                    if (Number(list[i])) {
                        images.push(Number(list[i]));
                    }
                }
                err === true
            }
            for (let i = 0; i < images.length; i++) {
                let pathFile = images[i]
                formData.imageList.push({
                    pathFile: pathFile,
                });
            }
        }
        let videos = [];
        if (req.body.videos) {
            if (!req.body.videos.includes("[")) {
                videos = req.body.videos;
            } else {
                let string = String(req.body.videos).replace("[", "");
                string = String(string).replace("]", "");
                let list = string.split(",");
                for (let i = 0; i < list.length; i++) {
                    if (Number(list[i])) {
                        videos.push(Number(list[i]));
                    }
                }
            }
            for (let i = 0; i < videos.length; i++) {
                let pathFile = videos[i]
                formData.imageList.push({
                    pathFile: pathFile,
                });
            }
            err === true
        }
        if (!fs.existsSync(`public/personalUpload`)) {
            fs.mkdirSync(`public/personalUpload`);
        }
        if (!fs.existsSync(`public/personalUpload/personalImage`)) {
            fs.mkdirSync(`public/personalUpload/personalImage`);
        }
        if (!fs.existsSync(`public/personalUpload/personalVideo`)) {
            fs.mkdirSync(`public/personalUpload/personalVideo`);
        }

        for (let i = 0; i < req.files.length; i++) {
            if (
                req.files[i].originalname.toUpperCase().includes('JPEG') ||
                req.files[i].originalname.toUpperCase().includes('PNG') ||
                req.files[i].originalname.toUpperCase().includes('JPG') ||
                req.files[i].originalname.toUpperCase().includes('GIF')
            ) {
                const pathFile = `${Date.now()}_${req.body.userId}${path.extname(
          req.files[i].originalname
        )}`;
                fs.writeFileSync(
                    `public/personalUpload/personalImage/${pathFile}`,
                    req.files[i].buffer
                );
                formData.imageList.push({
                    pathFile: pathFile,
                    sizeFile: req.files[i].size,
                });

            } else if (
                req.files[i].originalname.toUpperCase().includes('MP4') ||
                req.files[i].originalname.toUpperCase().includes('AVI') ||
                req.files[i].originalname.toUpperCase().includes('MKV') ||
                req.files[i].originalname.toUpperCase().includes('WMV')
            ) {
                const pathFile = `${Date.now()}_${req.body.userId}${path.extname(
          req.files[i].originalname
        )}`;
                fs.writeFileSync(
                    `public/personalUpload/personalVideo/${pathFile}`,
                    req.files[i].buffer
                );
                const arr = pathFile.split('.')
                arr.pop()
                const thumbnailName = `${arr.join('.')}.jpg`
                ffmpeg(`public/personalUpload/personalVideo/${pathFile}`)
                    .screenshots({
                        count: 1,
                        timemarks: ['00:00:02'],
                        folder: `public/personalUpload/personalVideo`,
                        filename: thumbnailName,
                    }).on('end', () => {
                        console.log('Thumbnail created successfully');
                    }).on('error', (err) => {
                        console.log(`Error creating thumbnail: ${err.message}`);
                    });

                formData.videoList.push({
                    pathFile: pathFile,
                    sizeFile: req.files[i].size,
                    thumbnailName: thumbnailName
                });

            } else {
                err = true;
                break;
            }
        }
        if (!err || err === true) {
            const personal = new Personal(formData);

            const savedpersonal = await personal.save();
            if (savedpersonal) {

                if (req.body.idAlbum) {
                    if (type == 0) {
                        await Personal.findOneAndUpdate({ _id: req.body.idAlbum }, {

                            imageList: [],
                            videoList: [],
                            imageListId: [],
                            videoListId: [],

                        })
                    }
                    await Personal.findOneAndUpdate({ _id: req.body.idAlbum }, {
                        $push: {
                            imageList: { $each: savedpersonal.imageList },
                            videoList: { $each: savedpersonal.videoList },
                            imageListId: { $each: savedpersonal.imageListId },
                            videoListId: { $each: savedpersonal.videoListId },
                        }
                    })
                }

                formData.createAt = Date.now();
                for (let i = 0; i < formData.imageList.length; i++) {
                    formData.imageListId.push(String(savedpersonal.imageList[savedpersonal.imageList.length - i - 1]._id))
                }
                for (let i = 0; i < formData.videoList.length; i++) {
                    formData.videoListId.push(String(savedpersonal.videoList[savedpersonal.videoList.length - i - 1]._id))
                }
                for (let i = 0; i < savedpersonal.imageList.length; i++) {
                    savedpersonal.imageList[
                        i
                        // ].pathFile = `http://43.239.223.142:9000/Testnode/public/personalUpload/personalImage/${savedpersonal.imageList[i].pathFile}`;
                    ].pathFile = `${urlImgHostwf()}personalUpload/personalImage/${savedpersonal.imageList[i].pathFile}`;
                }
                for (let j = 0; j < savedpersonal.videoList.length; j++) {
                    savedpersonal.videoList[
                        j
                    ].pathFile = `${urlImgHostwf()}personalUpload/personalVideo/${savedpersonal.videoList[j].pathFile}`;
                    savedpersonal.videoList[
                        j
                    ].thumbnailName = `${urlImgHostwf()}personalUpload/personalVideo/${savedpersonal.videoList[j].thumbnailName}`;
                }
                const backgroundImage = await Personal.find({ userId: Number(req.body.userId) }, { backgroundImage: 1 }).sort({ createAt: 'desc' }).limit(1)
                const backGround = []
                if (backgroundImage && backgroundImage.length > 0) {
                    backGround.push({
                        pathFile: backgroundImage[0].backgroundImage.pathFile,
                        sizeFile: backgroundImage[0].backgroundImage.sizeFile
                    })
                }

                const aloalo = await Personal.findOneAndUpdate({ _id: savedpersonal._id }, {
                    $push: {
                        imageListId: formData.imageListId,
                        videoListId: formData.videoListId,
                    },
                    $set: { backgroundImage: backGround }

                })


                //tag người vào bài viết
                if (req.body.listTag) {
                    if (!req.body.listTag.includes("[")) {
                        tag = req.body.listTag;
                    } else {
                        let string = String(req.body.listTag).replace("[", "");
                        string = String(string).replace("]", "");
                        let list = string.split(",");
                        for (let i = 0; i < list.length; i++) {
                            if (Number(list[i])) {
                                tag.push(Number(list[i]));
                            }
                        }
                    }
                }

                let updatePost
                for (let i = 0; i < tag.length; i++) {
                    const find = await User.findOne({ _id: tag[i] }, { userName: 1, avatarUser: 1 })
                        // console.log(find)
                    if (find.avatarUser !== "") {
                        find.avatarUser = `${urlImgHostwf()}avatarUser/${find._id}/${find.avatarUser}`;
                    } else {
                        find.avatarUser = `${find._id}`;
                    }
                    if (find && !savedpersonal.tagName.includes(find.userName) && !savedpersonal.tagAvatar.includes(find.avatarUser)) {
                        updatePost = await Personal.findOneAndUpdate({ _id: savedpersonal._id }, {
                            $push: { tagName: find.userName, tagAvatar: find.avatarUser }
                        }, { new: true })
                    }

                }
                if (updatePost) {
                    for (let i = 0; i < formData.imageList.length; i++) {
                        formData.imageListId.push(String(updatePost.imageList[updatePost.imageList.length - i - 1]._id))
                    }
                    for (let i = 0; i < formData.videoList.length; i++) {
                        formData.videoListId.push(String(updatePost.videoList[updatePost.videoList.length - i - 1]._id))
                    }
                    for (let i = 0; i < updatePost.imageList.length; i++) {
                        updatePost.imageList[
                            i
                            // ].pathFile = `http://43.239.223.142:9000/Testnode/public/personalUpload/personalImage/${updatePost.imageList[i].pathFile}`;
                        ].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${updatePost.imageList[i].pathFile}`;
                    }
                    for (let j = 0; j < updatePost.videoList.length; j++) {
                        updatePost.videoList[
                            j
                        ].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${updatePost.videoList[j].pathFile}`;
                        updatePost.videoList[
                            j
                        ].thumbnailName = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${updatePost.videoList[j].thumbnailName}`;
                    }

                    let listFriendId = [];
                    let checkFriend = await Contact.find({
                        $or: [
                            { userFist: Number(req.body.userId) },
                            { userSecond: Number(req.body.userId) }
                        ]
                    });
                    if (checkFriend) {
                        for (let i = 0; i < checkFriend.length; i++) {
                            listFriendId.push(checkFriend[i].userFist);
                            listFriendId.push(checkFriend[i].userSecond);
                        };
                        listFriendId = listFriendId.filter(e => Number(e) != Number(Number(req.body.userId)))
                    }
                    
                    let infoUser = await User.findOne({_id: req.body.userId},{userName:1})
                    for (let i = 0; i < listFriendId.length; i++) {
                        axios({
                            method: "post",
                            url: "http://43.239.223.142:9000/api/V2/Notification/SendNotification",
                            data: {
                                Title: "Thông báo trang cá nhân mới",
                                Message: `${infoUser.userName} đã tạo bài viết mới`,
                                Type: "SendCandidate",
                                UserId: listFriendId[i]
                            },
                            headers: { "Content-Type": "multipart/form-data" }
                        }).catch((e) => {
                            console.log(e)
                        })
                    }

                    res.json({
                        data: {
                            result: updatePost,
                            message: "Success",
                        },
                        error: null,
                    });
                } else {
                    res.json({
                        data: {
                            result: savedpersonal,
                            message: "Success",
                        },
                        error: null,
                    });
                }

            }
        } else {
            res
                .status(200)
                .json(
                    createError(200, "Dữ liệu truyền lên phải là hình ảnh hoặc video")
                );
        }

    } catch (err) {
        console.log(err);
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
};

// xóa bài viết
export const deletePost = async(req, res, next) => {

    try {
        if (req.params.token) {
            let check = await checkToken(req.params.token);
            if (check && check.status) {
                console.log("Token hop le, deletePost")
            } else {
                return res.status(404).json(createError(404, "Invalid token"));
            }
        }
        if (req && req.params && req.params.id) {
            const idPost = req.params.id;

            let findPost = await Personal.findOne({ _id: idPost }, { imageList: 1, videoList: 1, imageListId: 1, videoListId: 1, IdAlbum: 1 })
            let Image = findPost.imageList.map(Image => String(Image._id))

            let Video = findPost.videoList.map(Video => String(Video._id))
            let imageId = findPost.imageListId.map(imageId => String(imageId._id))
            let videoId = findPost.videoListId.map(videoId => String(videoId._id))
            if (findPost && findPost.IdAlbum) {

                await Personal.findOneAndUpdate({ _id: findPost.IdAlbum }, {
                    $pull: {
                        imageList: { _id: Image },
                        videoList: { _id: Video },
                        imageListId: { imageId },
                        videoListId: { videoId },
                    }
                })

            }

            const result = await Personal.findOneAndDelete({ _id: idPost })
            if (result) {
                if (result) {
                    res.status(200).json({ "message": "Success" });
                } else {
                    res.status(200).json(createError(200, "Id không chính xác"))
                }
            }
        } else {
            res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
        }
    } catch (err) {
        console.log(err);
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
}

// hiển thị 1 bài viết
export const getPost = async(req, res, next) => {

    try {
        if (req.params.token) {
            let check = await checkToken(req.params.token);
            if (check && check.status) {
                console.log("Token hop le, deletePost")
            } else {
                return res.status(404).json(createError(404, "Invalid token"));
            }
        }
        if (req && req.params && req.params._id) {
            const postId = req.params._id
            const post = await Personal.findOne({ _id: postId })

            if (post) {
                let totalComment = 0
                let totalEmotion = 0
                if (post.emotion) {
                    totalEmotion = post.emotion.split("/").length - 1;
                } else {
                    totalEmotion = 0;
                }
                for (let i = 0; i < post.commentList.length; i++) {
                    totalComment += 1
                }
                const result = {...post }
                result._doc.totalComment = totalComment
                result._doc.totalEmotion = totalEmotion

                for (let i = 0; i < post.imageList.length; i++) {
                    post.imageList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${post.imageList[i].pathFile}`
                }
                for (let i = 0; i < post.videoList.length; i++) {
                    post.videoList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${post.videoList[i].pathFile}`
                    post.videoList[i].thumbnailName = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${post.videoList[i].thumbnailName}`
                }

                res.status(200).json({
                    data: {
                        result: result._doc,
                        message: "Lấy thông tin thành công",
                    },
                    error: null
                });
            }
        } else {
            res.status(200).json(createError(200, "Chưa truyền đủ dữ liệu"));
        }
    } catch (err) {
        console.log(err);
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
}

// hiển thị tất cả bài viết
// IdSeen : Id của người xem bài viết đó
export const getAllPost = async(req, res, next) => {
        try {
            if (req.params.token) {
                let check = await checkToken(req.params.token);
                if (check && check.status && (check.userId == req.params.userId)) {
                    console.log("Token hop le, getAllPost")
                } else {
                    return res.status(404).json(createError(404, "Invalid token"));
                }
            }
            if (req && req.params && req.params.userId && req.params.IdSeen && Number(req.params.userId) && Number(req.params.IdSeen)) {
                const userId = req.params.userId;
                const listpost = Number(req.params.listpost)
                    // let personal = await Personal.find({ userId: userId }).sort({ createAt: 'desc' });
                let personal
                let checkPrivacy
                await ShowPersonal(Number(req.params.userId), Number(req.params.IdSeen)).then(e => checkPrivacy = e)
                console.log('checkPrivacy', checkPrivacy)
                if (checkPrivacy === true) {
                    personal = await Personal.find({ userId: userId, type: { $ne: 1 }, raw: { $exists: true } }).sort({ createAt: 'desc' });
                } else if (checkPrivacy === false) {
                    return res.status(200).json(createError(200, "Id không chính xác hoac khong co bai viet nao"))
                } else {
                    personal = await Personal.find({ userId: userId, createAt: { $gt: checkPrivacy }, type: { $ne: 1 }, raw: { $exists: true } }).sort({ createAt: 'desc' });
                }

                // check friend 0
                let check = false;
                let listFriendId = [];
                let checkFriend = await Contact.find({
                    $or: [
                        { userFist: userId },
                        { userSecond: userId }
                    ]
                });
                if (checkFriend) {
                    for (let i = 0; i < checkFriend.length; i++) {
                        listFriendId.push(checkFriend[i].userFist);
                        listFriendId.push(checkFriend[i].userSecond);
                    };
                    listFriendId = listFriendId.filter(e => Number(e) != Number(userId))
                }

                if (listFriendId.includes(Number(req.params.IdSeen))) {
                    check = true;
                }
                
                if (personal) {
                    if (personal.length > 0) {

                        for (let i = 0; i < personal.length; i++) {
                            let totalCommnet = 0
                            let comment = []
                            for (let j = 0; j < personal[i].commentList.length; j++) {
                                const user = await User.find({ _id: { $in: personal[i].commentList[j].listTag } }, { userName: 1, _id: 1, avatarUser: 1 })
                                if (user.avatarUser !== '') {
                                    user.avatarUser = `${urlImgHost()}/avatarUser/${user._id}/${user.avatarUser}`
                                } else {
                                    user.avatarUser = `${urlImgHost()}/avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                                }
                                personal[i]._doc.commentList[j].listTag = user

                                if (!personal[i].commentList[j].IdImage && !personal[i].commentList[j].IdVideo) {
                                    totalCommnet += 1

                                } else if (personal[i].commentList[j].IdImage) {

                                    comment.push({
                                        id: personal[i].commentList[j].IdImage,
                                    })

                                } else if (personal[i].commentList[j].IdVideo) {

                                    comment.push({
                                        id: personal[i].commentList[j].IdVideo,
                                    })
                                }
                            }

                            for (let j = 0; j < personal[i].imageList.length; j++) {

                                let count = comment.filter(item => item.id == personal[i].imageList[j]._id).length;

                                if (count >= 0) {
                                    personal[i]._doc.imageList[j]._doc.totalComment = count
                                } else {
                                    personal[i]._doc.imageList[j]._doc.totalComment = 0
                                }

                            }
                            personal[i]._doc.totalCommnet = totalCommnet

                            for (let j = 0; j < personal[i].videoList.length; j++) {

                                let count = comment.filter(item => item.id == personal[i].videoList[j]._id).length;

                                if (count >= 0) {
                                    personal[i]._doc.videoList[j]._doc.totalComment = count
                                } else {
                                    personal[i]._doc.videoList[j]._doc.totalComment = 0
                                }

                            }

                            // console.log(personal[i]._doc)
                            if (personal[i].emotion) {
                                personal[i]._doc.totalEmotion = personal[i].emotion.split("/").length - 1;
                            } else {
                                personal[i]._doc.totalEmotion = 0;
                            }
                            let arr = []
                            for (let j = 0; j < personal[i].imageListId.length; j++) {
                                arr = [...arr, ...personal[i].imageListId[j]]
                            }
                            personal[i].imageListId = arr
                            arr = []
                            for (let j = 0; j < personal[i].videoListId.length; j++) {
                                arr = [...arr, ...personal[i].videoListId[j]]
                            }
                            personal[i].videoListId = arr
                            for (let j = 0; j < personal[i].imageList.length; j++) {
                                personal[i].imageList[j].pathFile = `${urlImgHostwf()}personalUpload/personalImage/${personal[i].imageList[j].pathFile}`
                            }
                            for (let j = 0; j < personal[i].videoList.length; j++) {
                                personal[i].videoList[j].pathFile = `${urlImgHostwf()}TpersonalUpload/personalVideo/${personal[i].videoList[j].pathFile}`
                                personal[i].videoList[j].thumbnailName = `${urlImgHostwf()}personalUpload/personalVideo/${personal[i].videoList[j].thumbnailName}`
                            }
                            
                        }
                        for(let i = personal.length - 1; i >= 0; i--){
                           
                            if (Number(personal[i].raw) == "2") {
                                if (Number(req.params.IdSeen) != Number(req.params.userId)) {
                                    personal = personal.filter(e => e._id != personal[i]._id)
                                }
                            } else if (Number(personal[i].raw) === "1") {
                                if (!check) {
                                    personal = personal.filter(e => e._id != personal[i]._id);
                                }
                            } else if (personal[i].raw.includes('3/')) {

                                const s = personal[i].raw.slice(2, personal[i].raw.length)

                                if (!s.split(",").includes(String(req.params.IdSeen)) && Number(req.params.IdSeen) !== personal[i].userId) {
                                    personal = personal.filter(e => e._id != personal[i]._id)
                                }

                            } else if (personal[i].raw.includes('4/')) {
                                const s = personal[i].raw.slice(2, personal[i].raw.length)

                                if (s.split(",").includes(String(req.params.IdSeen))) {
                                    personal = personal.filter(e => e._id != personal[i]._id)
                                }
                                if (!check) {
                                    personal = personal.filter(e => e._id != personal[i]._id)
                                }
                            }
                        }
                        
                        let countpost = personal.length
                        if (countpost < 0) {
                            countpost = 0
                        }
                        let start = listpost
                        let end = listpost + 10

                        if (start >= countpost) {
                            start = countpost - 1
                        }
                        if (listpost + 10 > countpost) {
                            end = countpost
                        }

                        let personalListPost = []
                        for (let i = start; i < end; i++) {
                            personalListPost.push(personal[i])
                        }
                        res.status(200).json({
                            data: {
                                totalPost: personal.length,
                                result: personalListPost,
                                message: "Lấy thông tin thành công",
                            },
                            error: null
                        })

                    } else {
                        res.status(200).json(createError(200, "Id không chính xác hoac khong co bai viet nao"))
                    }
                } else res.status(200).json(createError(200, "Không có bài viết nào"));
            } else {
                res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
            }

        } catch (err) {
            console.log(err);
            res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
        }
}

// sửa bài viết
export const editPost = async(req, res, next) => {
    try {
        const formData = {...req.body };
        const id = req.params.id;
        const content = req.body.contentPost;
        const raw = req.body.raw;
        const type = req.body.type;
        const IdImage = req.body.IdImage
        const IdVideo = req.body.IdVideo
        const listTag = req.body.listTag

        // Thêm ảnh và video vào dữ liệu
        formData.imageList = [];
        formData.videoList = [];
        formData.imageListId = []
        formData.videoListId = []
        let err = false;

        for (let i = 0; i < req.files.length; i++) {
            if (
                req.files[i].originalname.toUpperCase().includes('JPEG') ||
                req.files[i].originalname.toUpperCase().includes('PNG') ||
                req.files[i].originalname.toUpperCase().includes('JPG') ||
                req.files[i].originalname.toUpperCase().includes('GIF')
            ) {
                const pathFile = `${Date.now()}${path.extname(
          req.files[i].originalname
        )}`;
                fs.writeFileSync(
                    `public/personalUpload/personalImage/${pathFile}`,
                    req.files[i].buffer
                );
                formData.imageList.push({
                    pathFile: pathFile,
                    sizeFile: req.files[i].size,
                });
            } else if (
                req.files[i].originalname.toUpperCase().includes('MP4') ||
                req.files[i].originalname.toUpperCase().includes('AVI') ||
                req.files[i].originalname.toUpperCase().includes('MKV') ||
                req.files[i].originalname.toUpperCase().includes('WMV')
            ) {
                const pathFile = `${Date.now()}${path.extname(
          req.files[i].originalname
        )}`;
                fs.writeFileSync(
                    `public/personalUpload/personalVideo/${pathFile}`,
                    req.files[i].buffer
                );
                const arr = pathFile.split('.')
                arr.pop()
                const thumbnailName = `${arr.join('.')}.jpg`
                ffmpeg(`public/personalUpload/personalVideo/${pathFile}`)
                    .screenshots({
                        count: 1,
                        timemarks: ['00:00:02'],
                        folder: `public/personalUpload/personalVideo`,
                        filename: thumbnailName,
                    }).on('end', () => {
                        console.log('Thumbnail created successfully');
                    }).on('error', (err) => {
                        console.log(`Error creating thumbnail: ${err.message}`);
                    });
                formData.videoList.push({
                    pathFile: pathFile,
                    sizeFile: req.files[i].size,
                    thumbnailName
                });
            } else {
                err = true;
                break;
            }
        }


        if (err === true || !err) {
            let update
            if (req.files) {
                
                update = await Personal.findOneAndUpdate({ _id: id }, {
                    contentPost: content,
                    raw: raw,
                    listTag: listTag,
                    $push: {
                        imageList: formData.imageList,
                        videoList: formData.videoList,
                    },
                }, { new: true });
                
                if(update && update.IdAlbum){
                    for (let i = formData.imageList.length; i > 0; i--) {
                        await Personal.findOneAndUpdate({ _id: update.IdAlbum }, {
                            $push: {
                                imageList: update.imageList[update.imageList.length - i],
                            }
                        }, { new: true })
                    }
    
                    for (let i = formData.videoList.length; i > 0; i--) {
                        await Personal.findOneAndUpdate({ _id: update.IdAlbum }, {
                            $push: {
                                videoList: update.videoList[update.videoList.length - i],
                            }
                        }, { new: true })
                    }
                }
                

                if (update) {
                    for (let i = 0; i < formData.imageList.length; i++) {

                        formData.imageListId.push(String(update.imageList[update.imageList.length - i - 1]._id))
                    }
                    for (let i = 0; i < formData.videoList.length; i++) {
                        formData.videoListId.push(String(update.videoList[update.videoList.length - i - 1]._id))
                    }
                    for (let i = 0; i < update.imageList.length; i++) {
                        update.imageList[
                            i
                        ].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${update.imageList[i].pathFile}`;


                    }
                    for (let i = 0; i < update.videoList.length; i++) {
                        update.videoList[
                            i
                        ].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].pathFile}`;
                        update.videoList[
                            i
                        ].thumbnailName = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].thumbnailName}`;


                    }
                    const update1 = await Personal.findOneAndUpdate({ _id: id }, {
                        $push: {
                            imageListId: formData.imageListId,
                            videoListId: formData.videoListId
                        },
                    }, { new: true });

                } else {
                    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
                }
            }
            if (IdImage || IdVideo) {
                
                const find = await Personal.findOne({ _id: id }, );

                let Image = [];
                let Video = []


                if (!String(req.body.IdImage).includes("[")) {

                } else {
                    let string = String(req.body.IdImage).replace("[", "");
                    string = String(string).replace("]", "");

                    let list = string.split(",");
                    for (let i = 0; i < list.length; i++) {
                        if (String(list[i])) {
                            Image.push(String(list[i]));
                        }
                    }
                }

                if (!String(req.body.IdVideo).includes("[")) {

                } else {
                    let string = String(req.body.IdVideo).replace("[", "");
                    string = String(string).replace("]", "");

                    let list = string.split(",");
                    for (let i = 0; i < list.length; i++) {
                        if (String(list[i])) {
                            Video.push(String(list[i]));
                        }
                    }
                }


                let intersection = []
                for (let i = 0; i < find.imageListId.length; i++) {

                    let check = find.imageListId[i].filter(x => Image.includes(x));
                    if (check.length > 0) {
                        intersection = check
                    }
                }


                let intersection1 = []
                for (let i = 0; i < find.videoListId.length; i++) {
                    let check = find.videoListId[i].filter(x => Video.includes(x));
                    if (check.length > 0) {
                        intersection1 = check
                    }
                }


                update = await Personal.findOneAndUpdate({ _id: id }, {
                    contentPost: content,
                    raw: raw,
                    listTag: listTag,
                    $pull: {
                        imageList: { _id: intersection },
                        videoList: { _id: intersection1 },
                    },
                }, { new: true });

                await Personal.findOneAndUpdate({ _id: update.IdAlbum }, {
                    $pull: {
                        imageList: { _id: intersection },
                        videoList: { _id: intersection1 },
                    },
                }, { new: true });
                if (update) {
                    for (let i = 0; i < update.imageList.length; i++) {
                        update.imageList[
                            i
                        ].pathFile = `http://43.239.223.142:9000/personalUpload/personalImage/${update.imageList[i].pathFile}`;

                    }

                    for (let i = 0; i < update.videoList.length; i++) {
                        update.videoList[
                            i
                        ].pathFile = `http://43.239.223.142:9000/personalUpload/personalVideo/${update.videoList[i].pathFile}`;
                        update.videoList[
                            i
                        ].thumbnailName = `http://43.239.223.142:9000/personalUpload/personalVideo/${update.videoList[i].thumbnailName}`;
                    }

                } else {
                    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
                }
            }

            //tag người vào bài viết
            let tag = []
            if (req.body.listTag) {
                if (!req.body.listTag.includes("[")) {
                    tag = req.body.listTag;
                } else {
                    let string = String(req.body.listTag).replace("[", "");
                    string = String(string).replace("]", "");
                    let list = string.split(",");
                    for (let i = 0; i < list.length; i++) {
                        if (Number(list[i])) {
                            tag.push(Number(list[i]));
                        }
                    }
                }
            }

            let updatePost
            let deleteTag
            if (!tag || tag.length >= 0) {

                deleteTag = await Personal.findOneAndUpdate({ _id: id }, {
                    tagName: [],
                    tagAvatar: []
                }, { new: true })
                if (deleteTag) {
                    for (let i = 0; i < deleteTag.imageList.length; i++) {
                        deleteTag.imageList[
                            i
                        ].pathFile = `http://43.239.223.142:9000/personalUpload/personalImage/${deleteTag.imageList[i].pathFile}`;

                    }

                    for (let i = 0; i < deleteTag.videoList.length; i++) {
                        deleteTag.videoList[
                            i
                        ].pathFile = `http://43.239.223.142:9000/personalUpload/personalVideo/${deleteTag.videoList[i].pathFile}`;
                        deleteTag.videoList[
                            i
                        ].thumbnailName = `http://43.239.223.142:9000/personalUpload/personalVideo/${deleteTag.videoList[i].thumbnailName}`;
                    }
                }
            }
            
            for (let i = 0; i < tag.length; i++) {
                const find = await User.findOne({ _id: tag[i] }, { userName: 1, avatarUser: 1 })
                    // console.log(find)
                if (find.avatarUser !== "") {
                    find.avatarUser = `${urlImgHostwf()}avatarUser/${find._id}/${find.avatarUser}`;
                } else {
                    find.avatarUser = `${find._id}`;
                }
                if (find) {

                    updatePost = await Personal.findOneAndUpdate({ _id: id }, {
                        $push: { tagName: find.userName, tagAvatar: find.avatarUser }
                    }, { new: true })
                  
                }

            }

            if (updatePost) {
                for (let i = 0; i < updatePost.imageList.length; i++) {
                    updatePost.imageList[
                        i
                    ].pathFile = `http://43.239.223.142:9000/personalUpload/personalImage/${updatePost.imageList[i].pathFile}`;

                }

                for (let i = 0; i < updatePost.videoList.length; i++) {
                    updatePost.videoList[
                        i
                    ].pathFile = `http://43.239.223.142:9000/personalUpload/personalVideo/${updatePost.videoList[i].pathFile}`;
                    updatePost.videoList[
                        i
                    ].thumbnailName = `http://43.239.223.142:9000/personalUpload/personalVideo/${updatePost.videoList[i].thumbnailName}`;
                }
            }
            if (updatePost) {

                res.json({
                    data: {
                        result: updatePost,
                        message: "Success",
                    },
                    error: null,
                });
            } else if (deleteTag) {

                res.json({
                    data: {
                        result: deleteTag,
                        message: "Success",
                    },
                    error: null,
                });
            }

        } else {
            res
                .status(200)
                .json(createError(200, "Thông tin truyền lên không chính xác"));
        }
    } catch (err) {
        console.log(err);
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
};

// tạo album ( thêm 2 trường album Name và contentAlbum)
export const createAlbum = async(req, res, next) => {
    try {
        if (req.body.token) {
            let check = await checkToken(req.body.token);
            if (check && check.status && (check.userId == req.body.userId)) {
                console.log("Token hop le, createAlbum")
            } else {
                return res.status(404).json(createError(404, "Invalid token"));
            }
        }
        const formData = {...req.body };
        // Thêm ảnh vào dữ liệu
        formData.imageList = [];
        formData.videoList = [];
        formData.contentAlbum = req.body.contentAlbum;
        formData.userId = req.body.userId;
        formData.albumName = req.body.albumName;
        formData.raw = req.body.raw;
        formData.imageListId = []
        formData.videoListId = []
        formData.type = 1;

        let findUser = await User.findOne({_id: Number(req.body.userId)},{userName:1, avatarUser:1})

        if(findUser){
            formData.userName = findUser.userName
            formData.avatarUser = `${urlImgHostwf()}avatarUser/${findUser._id}/${findUser.avatarUser}`;
        }else return res.status(200).json(createError(200, "Không tồn tại user"));
        
        let err = false;

        if (!fs.existsSync(`public/personalUpload`)) {
            fs.mkdirSync(`public/personalUpload`);
        }
        if (!fs.existsSync(`public/personalUpload/personalImage`)) {
            fs.mkdirSync(`public/personalUpload/personalImage`);
        }
        if (!fs.existsSync(`public/personalUpload/personalVideo`)) {
            fs.mkdirSync(`public/personalUpload/personalVideo`);
        }

        for (let i = 0; i < req.files.length; i++) {
            if (
                req.files[i].originalname.toUpperCase().includes('JPEG') ||
                req.files[i].originalname.toUpperCase().includes('PNG') ||
                req.files[i].originalname.toUpperCase().includes('JPG') ||
                req.files[i].originalname.toUpperCase().includes('GIF')
            ) {
                const pathFile = `${Date.now()}_${req.body.userId}${path.extname(
          req.files[i].originalname
        )}`;
                fs.writeFileSync(
                    `public/personalUpload/personalImage/${pathFile}`,
                    req.files[i].buffer
                );
                formData.imageList.push({
                    pathFile: pathFile,
                    sizeFile: req.files[i].size,
                });
            } else if (
                req.files[i].originalname.toUpperCase().includes('MP4') ||
                req.files[i].originalname.toUpperCase().includes('AVI') ||
                req.files[i].originalname.toUpperCase().includes('MKV') ||
                req.files[i].originalname.toUpperCase().includes('WMV')
            ) {
                const pathFile = `${Date.now()}_${req.body.userId}${path.extname(
          req.files[i].originalname
        )}`;
                fs.writeFileSync(
                    `public/personalUpload/personalVideo/${pathFile}`,
                    req.files[i].buffer
                );
                const arr = pathFile.split('.')
                arr.pop()
                const thumbnailName = `${arr.join('.')}.jpg`
                ffmpeg(`public/personalUpload/personalVideo/${pathFile}`)
                    .screenshots({
                        count: 1,
                        timemarks: ['00:00:02'],
                        folder: `public/personalUpload/personalVideo`,
                        filename: thumbnailName,
                    }).on('end', () => {
                        console.log('Thumbnail created successfully');
                    }).on('error', (err) => {
                        console.log(`Error creating thumbnail: ${err.message}`);
                    });
                formData.videoList.push({
                    pathFile: pathFile,
                    sizeFile: req.files[i].size,
                    thumbnailName
                });
            } else {
                err = true;
                break;
            }
        }
        if (!err || err === true && type == 1) {
            formData.createAt = Date.now();
            const personalalbum = new Personal(formData);
            const savedpersonalalbum = await personalalbum.save();
            if (savedpersonalalbum) {
                for (let i = 0; i < formData.imageList.length; i++) {
                    formData.imageListId.push(String(savedpersonalalbum.imageList[savedpersonalalbum.imageList.length - i - 1]._id))
                }
                for (let i = 0; i < formData.videoList.length; i++) {
                    formData.videoListId.push(String(savedpersonalalbum.videoList[savedpersonalalbum.videoList.length - i - 1]._id))
                }
                for (let i = 0; i < savedpersonalalbum.imageList.length; i++) {
                    savedpersonalalbum.imageList[
                        i
                    ].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${savedpersonalalbum.imageList[i].pathFile}`;
                }
                for (let i = 0; i < savedpersonalalbum.videoList.length; i++) {
                    savedpersonalalbum.videoList[
                        i
                    ].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${savedpersonalalbum.videoList[i].pathFile}`;
                    savedpersonalalbum.videoList[
                        i
                    ].thumbnailName = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${savedpersonalalbum.videoList[i].thumbnailName}`;
                }
                const update1 = await Personal.findOneAndUpdate({ _id: savedpersonalalbum._id }, {
                    $push: {
                        imageListId: formData.imageListId,
                        videoListId: formData.videoListId
                    },
                }, { new: true });
                res.json({
                    data: {
                        result: savedpersonalalbum,
                        message: "Success",
                    },
                    error: null,
                });
            }
        } else {
            res
                .status(200)
                .json(
                    createError(200, "Dữ liệu truyền lên phải là hình ảnh hoặc video")
                );
        }
    } catch (err) {
        console.log(err);
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
};

// update album ( thay đổi ảnh, tên album với nội dung album)
export const editAlbum = async(req, res, next) => {
    try {
        console.log(req.body);
        const formData = {...req.body };
        const id = req.params.id;
        const contentAlbum = req.body.contentAlbum;
        const albumName = req.body.albumName;
        const raw = req.body.raw;
        const type = req.body.type;
        const IdImage = req.body.IdImage
        const IdVideo = req.body.IdVideo

        formData.imageListId = []
        formData.videoListId = []
        formData.imageList = [];
        formData.videoList = [];
        let err = false;

        for (let i = 0; i < req.files.length; i++) {
            if (
                req.files[i].originalname.toUpperCase().includes('JPEG') ||
                req.files[i].originalname.toUpperCase().includes('PNG') ||
                req.files[i].originalname.toUpperCase().includes('JPG') ||
                req.files[i].originalname.toUpperCase().includes('GIF')
            ) {
                const pathFile = `${Date.now()}${path.extname(
          req.files[i].originalname
        )}`;
                fs.writeFileSync(
                    `public/personalUpload/personalImage/${pathFile}`,
                    req.files[i].buffer
                );
                formData.imageList.push({
                    pathFile: pathFile,
                    sizeFile: req.files[i].size,
                });
            } else if (
                req.files[i].originalname.toUpperCase().includes('MP4') ||
                req.files[i].originalname.toUpperCase().includes('AVI') ||
                req.files[i].originalname.toUpperCase().includes('MKV') ||
                req.files[i].originalname.toUpperCase().includes('WMV')

            ) {
                const pathFile = `${Date.now()}${path.extname(
          req.files[i].originalname
        )}`;
                fs.writeFileSync(
                    `public/personalUpload/personalVideo/${pathFile}`,
                    req.files[i].buffer
                );
                const arr = pathFile.split('.')
                arr.pop()
                const thumbnailName = `${arr.join('.')}.jpg`
                ffmpeg(`public/personalUpload/personalVideo/${pathFile}`)
                    .screenshots({
                        count: 1,
                        timemarks: ['00:00:02'],
                        folder: `public/personalUpload/personalVideo`,
                        filename: thumbnailName,
                    }).on('end', () => {
                        console.log('Thumbnail created successfully');
                    }).on('error', (err) => {
                        console.log(`Error creating thumbnail: ${err.message}`);
                    });
                formData.videoList.push({
                    pathFile: pathFile,
                    sizeFile: req.files[i].size,
                    thumbnailName
                });
            } else {
                err = true;
                break;
            }
        }
        if (err === true || !err) {
            if (!IdImage && !IdVideo) {
                const update = await Personal.findOneAndUpdate({ _id: id }, {
                    contentAlbum: contentAlbum,
                    albumName: albumName,
                    raw: raw,
                    $push: {
                        imageList: formData.imageList,
                        videoList: formData.videoList,
                    },
                }, { new: true });
                if (update) {
                    for (let i = 0; i < formData.imageList.length; i++) {
                        formData.imageListId.push(String(update.imageList[update.imageList.length - i - 1]._id))
                    }
                    for (let i = 0; i < formData.videoList.length; i++) {
                        formData.videoListId.push(String(update.videoList[update.videoList.length - i - 1]._id))
                    }
                    for (let i = 0; i < update.imageList.length; i++) {
                        update.imageList[
                            i
                        ].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${update.imageList[i].pathFile}`;
                    }
                    for (let i = 0; i < update.videoList.length; i++) {
                        update.videoList[
                            i
                        ].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].pathFile}`;
                        update.videoList[
                            i
                        ].thumbnailName = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].thumbnailName}`;
                    }
                    const update1 = await Personal.findOneAndUpdate({ _id: id }, {
                        $push: {
                            imageListId: formData.imageListId,
                            videoListId: formData.videoListId
                        },
                    }, { new: true });
                    res.json({
                        data: {
                            result: update,
                            message: "Success",
                        },
                        error: null,
                    });
                } else {
                    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
                }
            } else if (IdImage || IdVideo) {
                const find = await Personal.findOne({ _id: id }, );

                let Image = [];
                let Video = []
                if (!String(req.body.IdImage).includes("[")) {

                } else {
                    let string = String(req.body.IdImage).replace("[", "");
                    string = String(string).replace("]", "");

                    let list = string.split(",");
                    for (let i = 0; i < list.length; i++) {
                        if (String(list[i])) {
                            Image.push(String(list[i]));
                        }
                    }
                }

                if (!String(req.body.IdVideo).includes("[")) {

                } else {
                    let string = String(req.body.IdVideo).replace("[", "");
                    string = String(string).replace("]", "");

                    let list = string.split(",");
                    for (let i = 0; i < list.length; i++) {
                        if (String(list[i])) {
                            Video.push(String(list[i]));
                        }
                    }
                }

                let intersection = []
                for (let i = 0; i < find.imageListId.length; i++) {

                    let check = find.imageListId[i].filter(x => Image.includes(x));
                    if (check.length > 0) {
                        intersection = check
                    }
                }


                let intersection1 = []
                for (let i = 0; i < find.videoListId.length; i++) {
                    let check = find.videoListId[i].filter(x => Video.includes(x));
                    if (check.length > 0) {
                        intersection1 = check
                    }
                }

                const update = await Personal.findOneAndUpdate({ _id: id }, {
                    contentAlbum: contentAlbum,
                    albumName: albumName,
                    raw: raw,
                    $pull: {
                        imageList: { _id: intersection },
                        // imageListId: {_id: intersection},
                        videoList: { _id: intersection1 },
                    },
                }, { new: true });
                if (update) {
                    for (let i = 0; i < update.imageList.length; i++) {
                        update.imageList[
                            i
                        ].pathFile = `http://43.239.223.142:9000/personalUpload/personalImage/${update.imageList[i].pathFile}`;
                    }
                    for (let i = 0; i < update.videoList.length; i++) {
                        update.videoList[
                            i
                        ].pathFile = `http://43.239.223.142:9000/personalUpload/personalVideo/${update.videoList[i].pathFile}`;
                    }
                    res.json({
                        data: {
                            result: update,
                            message: "Success",
                        },
                        error: null,
                    });
                } else {
                    res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
                }
            }

            await Personal.updateMany({ IdAlbum: id }, { raw: raw, albumName: albumName }, { new: true })
        } else {
            res
                .status(200)
                .json(createError(200, "Thông tin truyền lên không chính xác"));
        }
    } catch (err) {
        console.log(err);
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
};

// hiển thị tất cả album
export const getAllAlbum = async(req, res, next) => {
    try {
        if (req.params.token) {
            let check = await checkToken(req.params.token);
            if (check && check.status && (check.userId == req.params.userId)) {
                console.log("Token hop le, getAllAlbum")
            } else {
                return res.status(404).json(createError(404, "Invalid token"));
            }
        }
        if (req && req.params && req.params.userId && req.params.IdSeen && Number(req.params.userId) && Number(req.params.IdSeen)) {
            const userId = req.params.userId;
            let personal = await Personal.find({ userId: userId, type: 1 }).sort({ createAt: 'desc' });
            
            // check friend 0
            let check = false;
            let listFriendId = [];
            let checkFriend = await Contact.find({
                $or: [
                    { userFist: userId },
                    { userSecond: userId }
                ]
            });
            if (checkFriend) {
                for (let i = 0; i < checkFriend.length; i++) {
                    listFriendId.push(checkFriend[i].userFist);
                    listFriendId.push(checkFriend[i].userSecond);
                };
                listFriendId = listFriendId.filter(e => Number(e) != Number(userId))
            }
            if (listFriendId.includes(Number(req.params.IdSeen))) {
                check = true;
            }
            if (personal) {
                if (personal.length > 0) {
                    for (let i = 0; i < personal.length; i++) {
                        let totalCommnet = 0
                        let comment = []
                        for (let j = 0; j < personal[i].commentList.length; j++) {
                            const user = await User.find({ _id: { $in: personal[i].commentList[j].listTag } }, { userName: 1, _id: 1, avatarUser: 1 })
                            if (user.avatarUser !== '') {
                                user.avatarUser = `${urlImgHost()}/avatarUser/${user._id}/${user.avatarUser}`
                            } else {
                                user.avatarUser = `${urlImgHost()}/avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                            }
                            personal[i]._doc.commentList[j].listTag = user

                            if (!personal[i].commentList[j].IdImage && !personal[i].commentList[j].IdVideo) {
                                totalCommnet += 1

                            } else if (personal[i].commentList[j].IdImage) {

                                comment.push({
                                    id: personal[i].commentList[j].IdImage,
                                })

                            } else if (personal[i].commentList[j].IdVideo) {

                                comment.push({
                                    id: personal[i].commentList[j].IdVideo,
                                })
                            }
                        }

                        for (let j = 0; j < personal[i].imageList.length; j++) {

                            let findPost = await Personal.findOne({ "imageList._id": personal[i].imageList[j]._id, userId: userId, contentPost: { $exists: true } }, { _id: 1, contentPost: 1 })

                            if (findPost) {
                                personal[i]._doc.imageList[j]._doc.postId = findPost._id
                                personal[i]._doc.imageList[j]._doc.contentPost = findPost.contentPost
                            } else {
                                personal[i]._doc.imageList[j]._doc.postId = null
                                personal[i]._doc.imageList[j]._doc.contentPost = null
                            }

                            let count = comment.filter(item => item.id == personal[i].imageList[j]._id).length;

                            if (count >= 0) {
                                personal[i]._doc.imageList[j]._doc.totalComment = count
                            } else {
                                personal[i]._doc.imageList[j]._doc.totalComment = 0
                            }

                        }
                        personal[i]._doc.totalCommnet = totalCommnet
                        
                        for (let j = 0; j < personal[i].videoList.length; j++) {

                            let findPost = await Personal.findOne({ "videoList._id": personal[i].videoList[j]._id, userId: userId, contentPost: { $exists: true } }, { _id: 1, contentPost: 1 })

                            if (findPost) {
                                personal[i]._doc.videoList[j]._doc.postId = findPost._id
                                personal[i]._doc.videoList[j]._doc.contentPost = findPost.contentPost
                            } else {
                                personal[i]._doc.videoList[j]._doc.postId = null
                                personal[i]._doc.videoList[j]._doc.contentPost = null
                            }

                            let count = comment.filter(item => item.id == personal[i].videoList[j]._id).length;

                            if (count >= 0) {
                                personal[i]._doc.videoList[j]._doc.totalComment = count
                            } else {
                                personal[i]._doc.videoList[j]._doc.totalComment = 0
                            }

                        }

                        // console.log(personal[i]._doc)
                        if (personal[i].emotion) {
                            personal[i]._doc.totalEmotion = personal[i].emotion.split("/").length - 1;
                        } else {
                            personal[i]._doc.totalEmotion = 0;
                        }

                        let arr = []
                        for (let j = 0; j < personal[i].imageListId.length; j++) {
                            arr = [...arr, ...personal[i].imageListId[j]]
                        }
                        personal[i].imageListId = arr
                        arr = []
                        for (let j = 0; j < personal[i].videoListId.length; j++) {
                            arr = [...arr, ...personal[i].videoListId[j]]
                        }
                        personal[i].videoListId = arr
                        for (let j = 0; j < personal[i].imageList.length; j++) {
                            personal[i].imageList[j].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${personal[i].imageList[j].pathFile}`
                        }
                        for (let j = 0; j < personal[i].videoList.length; j++) {
                            personal[i].videoList[j].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${personal[i].videoList[j].pathFile}`
                            personal[i].videoList[j].thumbnailName = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${personal[i].videoList[j].thumbnailName}`
                        } 
                    }
                    
                    for (let i = personal.length - 1; i >= 0; i--) {
                        if (String(personal[i].raw) === "2") {
                          if (Number(req.params.IdSeen) !== Number(req.params.userId)) {
                            personal = personal.filter(e => e._id != personal[i]._id);
                          }
                        } else if (Number(personal[i].raw) === "1") {
                          if (!check) {
                            personal = personal.filter(e => e._id != personal[i]._id);
                          }
                        } else if (personal[i].raw.includes('3/')) {
                          const s = personal[i].raw.slice(2);
                          if (!s.split(",").includes(String(req.params.IdSeen)) && Number(req.params.IdSeen) !== personal[i].userId) {
                            personal = personal.filter(e => e._id != personal[i]._id);
                          }
                        } else if (personal[i].raw.includes('4/')) {
                          const s = personal[i].raw.slice(2);
                          if (s.split(",").includes(String(req.params.IdSeen))) {
                            personal = personal.filter(e => e._id != personal[i]._id);
                          }
                          if (!check) {
                            personal = personal.filter(e => e._id != personal[i]._id);
                          }
                        }
                      }
                      
                    res.status(200).json({
                        data: {
                            result: personal,
                            message: "Lấy thông tin thành công",
                        },
                        error: null
                    })
                } else {
                    res.status(200).json(createError(200, "không có album nào"))
                }
            } else res.status(200).json(createError(200, "không có album nào"));
        } else {
            res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
        }

    } catch (err) {
        console.log(err);
        // res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
}

// xóa album 
export const deleteAlbum = async(req, res, next) => {
    try {
        if (req.params.token) {
            let check = await checkToken(req.params.token);
            if (check && check.status) {
                console.log("Token hop le, deleteAlbum")
            } else {
                return res.status(404).json(createError(404, "Invalid token"));
            }
        }
        if (req && req.params && req.params.id) {

            const id = req.params.id;

            const result = await Personal.findOneAndDelete({ _id: id })

            const deletePost = await Personal.deleteMany({ IdAlbum: id })
            if (result) {
                if (result) {
                    res.status(200).json({ "message": "Success" });
                } else {
                    res.status(200).json(createError(200, "Id không chính xác"))
                }
            }
        } else {
            res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
        }
    } catch (err) {
        console.log(err);
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
}

//hiển thị album
export const getAlbum = async(req, res, next) => {
    try {
        if (req.params.token) {
            let check = await checkToken(req.params.token);
            if (check && check.status) {
                console.log("Token hop le, getAlbum")
            } else {
                return res.status(404).json(createError(404, "Invalid token"));
            }
        }
        if (req && req.params && req.params._id) {
            const albumId = req.params._id
            const personal = await Personal.findOne({ _id: albumId })

            if (personal) {
                let totalCommnet = 0
                let comment = []
                for (let j = 0; j < personal.commentList.length; j++) {
                    const user = await User.find({ _id: { $in: personal.commentList[j].listTag } }, { userName: 1, _id: 1, avatarUser: 1 })
                    if (user.avatarUser !== '') {
                        user.avatarUser = `${urlImgHost()}/avatarUser/${user._id}/${user.avatarUser}`
                    } else {
                        user.avatarUser = `${urlImgHost()}/avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                    }
                    personal._doc.commentList[j].listTag = user

                    if (!personal.commentList[j].IdImage && !personal.commentList[j].IdVideo) {
                        totalCommnet += 1

                    } else if (personal.commentList[j].IdImage) {

                        comment.push({
                            id: personal.commentList[j].IdImage,
                        })

                    } else if (personal.commentList[j].IdVideo) {

                        comment.push({
                            id: personal.commentList[j].IdVideo,
                        })
                    }
                }

                for (let j = 0; j < personal.imageList.length; j++) {

                    let findPost = await Personal.findOne({ "imageList._id": personal.imageList[j]._id, contentPost: { $exists: true } }, { _id: 1, contentPost: 1 })

                    if (findPost) {
                        personal._doc.imageList[j]._doc.postId = findPost._id
                        personal._doc.imageList[j]._doc.contentPost = findPost.contentPost
                    } else {
                        personal._doc.imageList[j]._doc.postId = null
                        personal._doc.imageList[j]._doc.contentPost = null
                    }

                    let count = comment.filter(item => item.id == personal.imageList[j]._id).length;

                    if (count >= 0) {
                        personal._doc.imageList[j]._doc.totalComment = count
                    } else {
                        personal._doc.imageList[j]._doc.totalComment = 0
                    }

                }
                personal._doc.totalCommnet = totalCommnet

                for (let j = 0; j < personal.videoList.length; j++) {

                    let findPost = await Personal.findOne({ "videoList._id": personal.videoList[j]._id, contentPost: { $exists: true } }, { _id: 1, contentPost: 1 })

                    if (findPost) {
                        personal._doc.videoList[j]._doc.postId = findPost._id
                        personal._doc.videoList[j]._doc.contentPost = findPost.contentPost
                    } else {
                        personal._doc.videoList[j]._doc.postId = null
                        personal._doc.videoList[j]._doc.contentPost = null
                    }

                    let count = comment.filter(item => item.id == personal.videoList[j]._id).length;

                    if (count >= 0) {
                        personal._doc.videoList[j]._doc.totalComment = count
                    } else {
                        personal._doc.videoList[j]._doc.totalComment = 0
                    }

                }

                // console.log(personal._doc)
                if (personal.emotion) {
                    personal._doc.totalEmotion = personal.emotion.split("/").length - 1;
                } else {
                    personal._doc.totalEmotion = 0;
                }

                let arr = []
                for (let j = 0; j < personal.imageListId.length; j++) {
                    arr = [...arr, ...personal.imageListId[j]]
                }
                personal.imageListId = arr
                arr = []
                for (let j = 0; j < personal.videoListId.length; j++) {
                    arr = [...arr, ...personal.videoListId[j]]
                }
                personal.videoListId = arr

                let totalImage = 0
                let totalVideo = 0

                for (let i = 0; i < personal.imageList.length; i++) {
                    totalImage += 1
                }
                for (let i = 0; i < personal.videoList.length; i++) {
                    totalVideo += 1
                }

                personal._doc.totalImage = totalImage
                personal._doc.totalVideo = totalVideo

                for (let i = 0; i < personal.imageList.length; i++) {
                    personal.imageList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${personal.imageList[i].pathFile}`
                }
                for (let i = 0; i < personal.videoList.length; i++) {
                    personal.videoList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${personal.videoList[i].pathFile}`
                }
                res.status(200).json({
                    data: {
                        personal: personal,
                        message: "Lấy thông tin thành công",
                    },
                    error: null
                });

            } else {
                res.status(200).json(createError(200, "Id không chính xác"))
            }
        } else {
            res.status(200).json(createError(200, "Chưa truyền đủ dữ liệu"));
        }
    } catch (err) {
        console.log(err);
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
}

//update backgroundImage
export const backgroundImg = async(req, res, next) => {
    try {
        if (req.body.token) {
            let check = await checkToken(req.body.token);
            if (check && check.status && (check.userId == req.body.userId)) {
                console.log("Token hop le, backgroundImg")
            } else {
                return res.status(404).json(createError(404, "Invalid token"));
            }
        }
        console.log(req.body)
        const files = [];
        const formData = {...req.body }
        const userId = req.body.userId
        let err = false

        if (!fs.existsSync(`public/personalBackgroundImg`)) {
            fs.mkdirSync(`public/personalBackgroundImg`);
        }

        for (let i = 0; i < req.files.length; i++) {
            if (req.files[i].mimetype === 'image/jpeg' || req.files[i].mimetype === 'application/octet-stream' || req.files[i].mimetype === 'image/jpg' || req.files[i].mimetype === 'image/png') {
                const pathFile = `${Date.now()}_${req.body.userId}${path.extname(
          req.files[i].originalname
        )}`;
                fs.writeFileSync(`public/personalBackgroundImg/${pathFile}`, req.files[i].buffer)

                files.push({
                    pathFile: pathFile,
                    sizeFile: req.files[i].size,
                })
            } else {
                err = true
                break
            }

        }
        if (!err) {
            const updatebackground = await Personal.updateMany({ userId: userId }, { $set: { backgroundImage: files } }, { upsert: true })
            if (updatebackground) {

                const backgroundImg = await Personal.findOne({ userId: userId })
                for (let i = 0; i < backgroundImg.backgroundImage.length; i++) {
                    backgroundImg.backgroundImage[i].pathFile = `${urlImgHostwf()}Testnode/public/personalBackgroundImg/${backgroundImg.backgroundImage[i].pathFile}`
                }
                res.json({
                    data: {
                        result: backgroundImg,
                        message: "Update Background Thành công"
                    },
                    error: null
                })
            } else {
                res.status(200).json(createError(200, "Đã có lỗi xảy ra"))
            }

        } else { res.status(200).json(createError(200, "Chưa nhập dữ liệu")); }
    } catch (err) {
        console.log(err);
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
}

//Tạo bình luận (nếu 1 là personal, 2 là diary)
export const createComment = async(req, res, next) => {
    try {
        if (req.body.token) {
            let check = await checkToken(req.body.token);
            if (check && check.status && (check.userId == req.body.commentatorId)) {
                console.log("Token hop le, createComment")
            } else {
                return res.status(404).json(createError(404, "Invalid token"));
            }
        }
        if (req && req.body && req.body.type) {
            const formData = {...req.body };
            let listTag = []
            if (req.body.listTag) {
                listTag = req.body.listTag.replace('[', '').replace(']', '').split(',')
                listTag = listTag.map(userId => Number(userId))
            }
            const user = await User.findOne({ _id: Number(req.body.commentatorId) }, { userName: 1, avatarUser: 1 });
            if (user.avatarUser !== "") {
                user.avatarUser = `${urlImgHostwf()}avatarUser/${user.avatarUser}`;
            } else {
                user.avatarUser = `${urlImgHostwf()}avatar/${user.userName[0]
          }_${Math.floor(Math.random() * 4) + 1}.png`;
            }
            let pathFile
            if (req.file) {
                pathFile = `${Date.now()}_${req.body.userId}${path.extname(
          req.file.originalname.replace(/[ +!@#$%^&*]/g, '')
        )}`;
                fs.writeFileSync(
                    `public/personalUpload/personalImage/${pathFile}`,
                    req.file.buffer
                );
            }
            let commentInsert = {
                content: String(req.body.content),
                commentatorId: Number(req.body.commentatorId),
                commentName: user.userName,
                commentAvatar: user.avatarUser,
                image: pathFile,
                listTag,
                createAt: new Date(),
            };

            let commentImageInsert = {
                IdImage: String(req.body.IdImage),
                content: String(req.body.content),
                commentatorId: Number(req.body.commentatorId),
                commentName: user.userName,
                commentAvatar: user.avatarUser,
                image: pathFile,
                listTag,
                createAt: new Date(),
            }

            let commentVideoInsert = {
                IdVideo: String(req.body.IdVideo),
                content: String(req.body.content),
                commentatorId: Number(req.body.commentatorId),
                commentName: user.userName,
                commentAvatar: user.avatarUser,
                image: pathFile,
                listTag,
                createAt: new Date(),
            }

            let update
            
            if (String(req.body.type) === "1") {
                update = await Personal.findByIdAndUpdate({ _id: String(req.body.id) }, { $push: { commentList: commentInsert } }, { new: true });

                if (update) {
                    let totalCommnet = 0
                    for (let i = 0; i < update.commentList.length; i++) {
                        if (update.commentList[i].image) {
                            update.commentList[i].image = `${urlImgHostwf()}/personalUpload/personalImage/${update.commentList[i].image}`
                        }
                        if (update.commentList[i].listTag.length > 0) {
                            const user = await User.find({ _id: { $in: update.commentList[i].listTag } }, { userName: 1, _id: 1, avatarUser: 1 })
                            if (user.avatarUser !== '') {
                                user.avatarUser = `${urlImgHost()}/avatarUser/${user.avatarUser}`
                            } else {
                                user.avatarUser = `${urlImgHost()}/avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                            }
                            update.commentList[i].listTag = user
                        }
                        if (!update.commentList[i].IdImage && !update.commentList[i].IdVideo) {
                            totalCommnet += 1
                        }
                    }
                    update._doc.totalCommnet = totalCommnet
                    for (let i = 0; i < update.imageList.length; i++) {
                        update.imageList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${update.imageList[i].pathFile}`
                    }
                    for (let i = 0; i < update.videoList.length; i++) {
                        update.videoList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].pathFile}`
                        update.videoList[i].thumbnailName = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].thumbnailName}`
                    }
                    if (update.emotion) {
                        update._doc.totalEmotion = update.emotion.split("/").length - 1;
                    } else {
                        update._doc.totalEmotion = 0;
                    }
                    res.json({
                        data: {
                            result: update,
                            message: "Thêm bình luận thành công",
                        },
                        error: null,
                    });
                }
            }

            if (String(req.body.type) === "2") {

                update = await Diary.findByIdAndUpdate({ _id: String(req.body.id) }, { $push: { commentList: commentInsert } }, { new: true });

                if (update) {
                    update.commentList = update.commentList.slice(-1)
                    res.json({
                        data: {
                            result: update,
                            message: "Thêm bình luận thành công",
                        },
                        error: null,
                    });
                }
            }

            if (String(req.body.type) === "3") {
                if (req.body.IdImage) {
                    update = await Personal.findByIdAndUpdate({ _id: String(req.body.id) }, { $push: { commentList: commentImageInsert } }, { new: true });

                    if (update && update.IdAlbum && update.IdAlbum != null) {
                        let index = update.commentList.length - 1
                        const updateAlbum = await Personal.findByIdAndUpdate({ _id: String(update.IdAlbum) }, { $push: { commentList: update.commentList[index] } }, { new: true });
                    } else {
                        let findPostUserAlbum = await Personal.find({
                            IdAlbum: update._id
                        }, { _id: 1 }).lean()
                        if (findPostUserAlbum && findPostUserAlbum.length > 0) {
                            await Personal.updateMany({ _id: { $in: findPostUserAlbum } }, { $push: { commentList: commentImageInsert } })
                        }

                    }

                    if (update) {
                        for (let i = 0; i < update.commentList.length; i++) {
                            if (update.commentList[i].image) {
                                update.commentList[i].image = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${update.commentList[i].image}`
                            }
                            if (update.commentList[i].listTag.length > 0) {
                                const user = await User.find({ _id: { $in: update.commentList[i].listTag } }, { userName: 1, _id: 1, avatarUser: 1 })
                                if (user.avatarUser !== '') {
                                    user.avatarUser = `${urlImgHost()}/avatarUser/${user._id}/${user.avatarUser}`
                                } else {
                                    user.avatarUser = `${urlImgHost()}/avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                                }
                                update.commentList[i].listTag = user
                            }
                        }
                        for (let i = 0; i < update.imageList.length; i++) {
                            update.imageList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${update.imageList[i].pathFile}`
                        }
                        for (let i = 0; i < update.videoList.length; i++) {
                            update.videoList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].pathFile}`
                            update.videoList[i].thumbnailName = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].thumbnailName}`
                        }
                        if (update.emotion) {
                            update._doc.totalEmotion = update.emotion.split("/").length - 1;
                        } else {
                            update._doc.totalEmotion = 0;
                        }
                        res.json({
                            data: {
                                result: update,
                                message: "Thêm bình luận ảnh thành công",
                            },
                            error: null,
                        });
                    }
                } else { return res.status(200).json(createError(200, "Sai type hoặc chưa truyền lên IdImage")) };

            }

            if (String(req.body.type) === "4") {
                if (req.body.IdVideo) {
                    update = await Personal.findByIdAndUpdate({ _id: String(req.body.id) }, { $push: { commentList: commentVideoInsert } }, { new: true });

                    if (update && update.IdAlbum && update.IdAlbum != null) {
                        const updateAlbum = await Personal.findByIdAndUpdate({ _id: String(update.IdAlbum) }, { $push: { commentList: commentVideoInsert } }, { new: true });
                    } else {
                        let findPostUserAlbum = await Personal.find({
                            IdAlbum: update._id
                        }, { _id: 1 }).lean()
                        if (findPostUserAlbum && findPostUserAlbum.length > 0) {
                            await Personal.updateMany({ _id: { $in: findPostUserAlbum } }, { $push: { commentList: commentVideoInsert } })
                        }

                    }

                    if (update) {
                        for (let i = 0; i < update.commentList.length; i++) {
                            if (update.commentList[i].image) {
                                update.commentList[i].image = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${update.commentList[i].image}`
                            }
                            if (update.commentList[i].listTag.length > 0) {
                                const user = await User.find({ _id: { $in: update.commentList[i].listTag } }, { userName: 1, _id: 1, avatarUser: 1 })
                                if (user.avatarUser !== '') {
                                    user.avatarUser = `${urlImgHost()}/avatarUser/${user._id}/${user.avatarUser}`
                                } else {
                                    user.avatarUser = `${urlImgHost()}/avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                                }
                                update.commentList[i].listTag = user
                            }
                        }
                        for (let i = 0; i < update.imageList.length; i++) {
                            update.imageList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${update.imageList[i].pathFile}`
                        }
                        for (let i = 0; i < update.videoList.length; i++) {
                            update.videoList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].pathFile}`
                            update.videoList[i].thumbnailName = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].thumbnailName}`
                        }
                        if (update.emotion) {
                            update._doc.totalEmotion = update.emotion.split("/").length - 1;
                        } else {
                            update._doc.totalEmotion = 0;
                        }
                        res.json({
                            data: {
                                result: update,
                                message: "Thêm bình luận video thành công",
                            },
                            error: null,
                        });
                    }
                } else { return res.status(200).json(createError(200, "Sai type hoặc chưa truyền lên Idvideo")) };

            }
            
            // if(Number(update.userId) != Number(req.body.commentatorId)){
            //     axios({
            //         method: "post",
            //         url: "http://43.239.223.142:9000/api/V2/Notification/SendNotification",
            //         data: {
            //             Title: "Thông báo trang cá nhân mới",
            //             Message: `${user.userName} đã bình luận bài viết của bạn`,
            //             Type: "SendCandidate",
            //             UserId: update.userId
            //         },
            //         headers: { "Content-Type": "multipart/form-data" }
            //     }).catch((e) => {
            //         console.log(e)
            //     })
            // }
        }
    } catch (err) {
        console.log(err);
        res.status(200).json(createError(200, "Có lỗi xảy ra"));
    }
};

// cập nhật bình luận (nếu 1 là personal, 2 là diary)
export const updateComment = async(req, res, next) => {
    try {
        if (req.body.token) {
            let check = await checkToken(req.body.token);
            if (check && check.status && (check.userId == req.body.commentatorId)) {
                console.log("Token hop le, updateComment")
            } else {
                return res.status(404).json(createError(404, "Invalid token"));
            }
        }
        if (req && req.body && req.body.type) {
            const formData = {...req.body };

            if (String(req.body.type) === "1") {
                let isImage = req.body.isImage ? req.body.isImage : 1
                let listTag = []
                if (req.body.listTag) {
                    listTag = req.body.listTag.replace('[', '').replace(']', '').split(',')
                    listTag = listTag.map(userId => Number(userId))
                }
                let pathFile
                if (req.file) {
                    pathFile = `${Date.now()}_${req.body.userId}${path.extname(
            req.file.originalname
          )}`;
                    fs.writeFileSync(
                        `public/personalUpload/personalImage/${pathFile}`,
                        req.file.buffer
                    );
                }
                let update
                if (req.file) {
                    update = await Personal.findOneAndUpdate({
                        _id: String(req.body.id), // id bài viết,
                        "commentList._id": formData.commentId,
                        "commentList.commentatorId": Number(formData.commentatorId),
                    }, {
                        $set: {
                            "commentList.$[ele].content": formData.content,
                            "commentList.$[ele].image": pathFile,
                            "commentList.$[ele].listTag": listTag
                        },
                    }, { "arrayFilters": [{ "ele._id": req.body.commentId }], new: true });
                } else if (isImage == 1) {
                    update = await Personal.findOneAndUpdate({
                        _id: String(req.body.id), // id bài viết,
                        "commentList._id": formData.commentId,
                        "commentList.commentatorId": Number(formData.commentatorId),
                    }, {
                        $set: {
                            "commentList.$[ele].content": formData.content,
                            "commentList.$[ele].listTag": listTag
                        },
                    }, { "arrayFilters": [{ "ele._id": req.body.commentId }], new: true });
                } else if (isImage == 0) {
                    update = await Personal.findOneAndUpdate({
                        _id: String(req.body.id), // id bài viết,
                        "commentList._id": formData.commentId,
                        "commentList.commentatorId": Number(formData.commentatorId),
                    }, {
                        $set: {
                            "commentList.$[ele].content": formData.content,
                            "commentList.$[ele].image": null,
                            "commentList.$[ele].listTag": listTag
                        },
                    }, { "arrayFilters": [{ "ele._id": req.body.commentId }], new: true });
                }
                if (update) {
                    let totalCommnet = 0
                    for (let i = 0; i < update.commentList.length; i++) {
                        if (update.commentList[i].image) {
                            update.commentList[i].image = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${update.commentList[i].image}`
                        }
                        if (update.commentList[i].listTag.length > 0) {
                            const user = await User.find({ _id: { $in: update.commentList[i].listTag } }, { userName: 1, _id: 1, avatarUser: 1 })
                            if (user.avatarUser !== '') {
                                user.avatarUser = `${urlImgHost()}/avatarUser/${user._id}/${user.avatarUser}`
                            } else {
                                user.avatarUser = `${urlImgHost()}/avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                            }
                            update.commentList[i].listTag = user
                        }
                        if (!update.commentList[i].IdImage && !update.commentList[i].IdVideo) {
                            totalCommnet += 1
                        }
                    }
                    update._doc.totalCommnet = totalCommnet
                    for (let i = 0; i < update.imageList.length; i++) {
                        update.imageList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${update.imageList[i].pathFile}`
                    }
                    for (let i = 0; i < update.videoList.length; i++) {
                        update.videoList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].pathFile}`
                        update.videoList[i].thumbnailName = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].thumbnailName}`
                    }
                    if (update.emotion) {
                        update._doc.totalEmotion = update.emotion.split("/").length - 1;
                    } else {
                        update._doc.totalEmotion = 0;
                    }
                    res.json({
                        data: {
                            result: update,
                            message: "Thêm bình luận thành công",
                        },
                        error: null,
                    });
                }
            }
            if (String(req.body.type) === "2") {
                // console.log(req.body)
                let update = await Diary.findOneAndUpdate({
                        _id: String(req.body.id), // id bài viết,
                        "commentList._id": formData.commentId,
                        "commentList._commentatorId": Number(formData.commentatorId)
                    }, {
                        $set: {
                            "commentList.$.content": formData.content,
                        },
                    }, { new: true } // nội dung bình luận mới }
                );
                if (update) {
                    res.json({
                        data: {
                            result: update,
                            message: "Thêm bình luận thành công",
                        },
                        error: null,
                    });
                }
            } else res.status(200).json(createError(200, "truyền sai"));

        }
    } catch (err) {
        console.log(err);
        res.status(200).json(createError(200, "Có lỗi xảy ra"));
    }
};

// xóa bình luận (nếu 1 là personal, 2 là diary)
export const deleteComment = async(req, res, next) => {
    try {
        if (req.body.token) {
            let check = await checkToken(req.body.token);
            if (check && check.status && (check.userId == req.body.commentatorId)) {
                console.log("Token hop le, deleteComment")
            } else {
                return res.status(404).json(createError(404, "Invalid token"));
            }
        }
        if (req && req.body && req.body.type) {
            const formData = {...req.body };
            let update
            if (String(req.body.type) === "1") {
                const user = await User.findOne({ _id: Number(req.body.commentatorId) }, { userName: 1, avatarUser: 1 });
                if (user.avatarUser !== "") {
                    user.avatarUser = `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`;
                } else {
                    user.avatarUser = `${urlImgHostwf()}avatar/${user.userName[0]
            }_${Math.floor(Math.random() * 4) + 1}.png`;
                }

                update = await Personal.findOneAndUpdate({
                    _id: String(req.body.id),
                    "commentList._id": formData.commentId,
                    "commentList._commentatorId": Number(req.body.commentatorId),
                }, {
                    $pull: {
                        commentList: {
                            _id: formData.commentId,
                            commentatorId: Number(req.body.commentatorId),
                            commentName: user.userName,
                            commentAvatar: user.avatarUser,
                        },
                    },
                }, { new: true });

            }

            if (String(req.body.type) === "2") {
                const user = await User.findOne({ _id: Number(req.body.commentatorId) }, { userName: 1, avatarUser: 1 });

                if (user.avatarUser !== "") {
                    user.avatarUser = `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`;
                } else {
                    user.avatarUser = `${urlImgHostwf()}avatar/${user.userName[0]
            }_${Math.floor(Math.random() * 4) + 1}.png`;
                }

                update = await Diary.findOneAndUpdate({
                    _id: String(req.body.id),
                    "commentList._id": formData.commentId,
                    "commentList._commentatorId": Number(req.body.commentatorId),
                }, {
                    $pull: {
                        commentList: {
                            _id: formData.commentId,
                            commentatorId: Number(req.body.commentatorId),
                            commentName: user.userName,
                            commentAvatar: user.avatarUser,
                        },
                    },
                }, { new: true });

            }

            if (String(req.body.type) === "3") {
                const user = await User.findOne({ _id: Number(req.body.commentatorId) }, { userName: 1, avatarUser: 1 });
                if (user.avatarUser !== "") {
                    user.avatarUser = `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`;
                } else {
                    user.avatarUser = `${urlImgHostwf()}avatar/${user.userName[0]
            }_${Math.floor(Math.random() * 4) + 1}.png`;
                }

                update = await Personal.findOneAndUpdate({
                    _id: String(req.body.id),
                    "commentList._id": formData.commentId,
                    "commentList._commentatorId": Number(req.body.commentatorId),
                }, {
                    $pull: {
                        commentList: {
                            IdImage: formData.IdImage,
                            _id: formData.commentId,
                            commentatorId: Number(req.body.commentatorId),
                            commentName: user.userName,
                            commentAvatar: user.avatarUser,
                        },
                    },
                }, { new: true });

            }

            if (String(req.body.type) === "4") {
                const user = await User.findOne({ _id: Number(req.body.commentatorId) }, { userName: 1, avatarUser: 1 });
                if (user.avatarUser !== "") {
                    user.avatarUser = `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`;
                } else {
                    user.avatarUser = `${urlImgHostwf()}avatar/${user.userName[0]
            }_${Math.floor(Math.random() * 4) + 1}.png`;
                }

                update = await Personal.findOneAndUpdate({
                    _id: String(req.body.id),
                    "commentList._id": formData.commentId,
                    "commentList._commentatorId": Number(req.body.commentatorId),
                }, {
                    $pull: {
                        commentList: {
                            IdVideo: formData.IdVideo,
                            _id: formData.commentId,
                            commentatorId: Number(req.body.commentatorId),
                            commentName: user.userName,
                            commentAvatar: user.avatarUser,
                        },
                    },
                }, { new: true });

            }

            if (update) {
                let totalCommnet = 0
                for (let i = 0; i < update.commentList.length; i++) {
                    if (update.commentList[i].image) {
                        update.commentList[i].image = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${update.commentList[i].image}`
                    }
                    if (update.commentList[i].listTag.length > 0) {
                        const user = await User.find({ _id: { $in: update.commentList[i].listTag } }, { userName: 1, _id: 1, avatarUser: 1 })
                        if (user.avatarUser !== '') {
                            user.avatarUser = `${urlImgHost()}/avatarUser/${user._id}/${user.avatarUser}`
                        } else {
                            user.avatarUser = `${urlImgHost()}/avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                        }
                        update.commentList[i].listTag = user
                    }
                    if (!update.commentList[i].IdImage && !update.commentList[i].IdVideo) {
                        totalCommnet += 1
                    }
                }
                update._doc.totalCommnet = totalCommnet

                if (update.emotion) {
                    update._doc.totalEmotion = update.emotion.split("/").length - 1;
                } else {
                    update._doc.totalEmotion = 0;
                }

                for (let i = 0; i < update.imageList.length; i++) {
                    update.imageList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${update.imageList[i].pathFile}`
                }
                for (let i = 0; i < update.videoList.length; i++) {
                    update.videoList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].pathFile}`
                    update.videoList[i].thumbnailName = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].thumbnailName}`
                }

                res.status(200).json({
                    data: {
                        result: update._doc,
                        message: "Xóa bình luận thành công",
                    },
                    error: null,
                });

            } else return res.status(200).json(createError(200, "Có lỗi xảy ra"));
        }
    } catch (err) {
        console.log(err);
        res.status(200).json(createError(200, "Có lỗi xảy ra"));
    }
};

//thêm like và đếm like của bài viết
export const releaseEmotion = async(req, res, next) => {
    try {
        if (req.body.token) {
            let check = await checkToken(req.body.token);
            if (check && check.status && (check.userId == req.body.userSendId)) {
                console.log("Token hop le, releaseEmotion")
            } else {
                return res.status(404).json(createError(404, "Invalid token"));
            }
        }
        if (req && req.body) {
            const data = {};
            let totalEmotion, message;
            data.userSendId = req.body.userSendId;
            data.postId = req.body._id;
            const user = await User.findOne({ _id: Number(req.body.userSendId) }, { userName: 1, avatarUser: 1 });
            const postPersonal = await Personal.findOne({ _id: data.postId });

            let UserLikeName = postPersonal.emotionName
            let UserLikeAvatar = postPersonal.emotionAvatar
            const arname = UserLikeName.split(",")
            const aravatar = UserLikeAvatar.split(",")
            if (postPersonal.emotion) {
                if (postPersonal.emotion.split("/").includes(data.userSendId)) {
                    //Xóa lượt thích
                    postPersonal.emotion = postPersonal.emotion.replace(
                        `${data.userSendId}/`,
                        ""
                    );
                    arname.splice(arname.indexOf(String(user.userName)), 1)
                    UserLikeName = arname.join(",")
                    if (user.avatarUser !== "") {
                        aravatar.splice(
                            aravatar.indexOf(
                                `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`
                            ),
                            1
                        );
                    } else {
                        aravatar.splice(
                            aravatar.indexOf(
                                `${urlImgHostwf()}avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1
                }.png`
                            ),
                            1
                        );
                    }
                    UserLikeAvatar = aravatar.join(",");
                } else {
                    postPersonal.emotion = `${postPersonal.emotion}${data.userSendId}/`;
                    arname.push(String(user.userName))
                    UserLikeName = arname.join(",");
                    if (user.avatarUser !== "") {
                        aravatar.push(
                            `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`
                        );
                    } else {
                        aravatar.push(
                            `${urlImgHostwf()}avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1
              }.png`
                        );
                    }
                    UserLikeAvatar = aravatar.join(","); //Thêm lượt thích
                }
            } else {
                postPersonal.emotion = `${data.userSendId}/`;
                arname.push(String(user.userName))

                UserLikeName = arname.join(",")
                if (user.avatarUser !== "") {
                    aravatar.push(
                        `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`
                    );
                } else {
                    aravatar.push(
                        `${urlImgHostwf()}avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1
            }.png`
                    );
                }
                UserLikeAvatar = aravatar.join(",") //Thêm lượt thích
            }

            if (postPersonal.emotion) {
                totalEmotion = postPersonal.emotion.split("/").length - 1;
            } else {
                totalEmotion = 0;
            }

            const personal = await Personal.findOneAndUpdate({ _id: data.postId }, { emotion: postPersonal.emotion, emotionName: UserLikeName, emotionAvatar: UserLikeAvatar }, { new: true });
            if (personal) {
                // const user = await User.findOne({ _id: Number(data.userSendId) }, { userName: 1, avatarUser: 1 });
                // if (currentTotalEmotion < totalEmotion) {
                //     message = `${user.userName} đã thích 1 bài viết của bạn`
                // }

                for (let i = 0; i < personal.imageList.length; i++) {
                    personal.imageList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${personal.imageList[i].pathFile}`
                }
                for (let i = 0; i < personal.videoList.length; i++) {
                    personal.videoList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${personal.videoList[i].pathFile}`
                    personal.videoList[i].thumbnailName = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${personal.videoList[i].thumbnailName}`
                }
                const result = {...personal };
                result._doc.totalEmotion = totalEmotion;

                //thêm tổng số comment bài viết, comment ảnh, video
                let totalCommnet = 0
                let comment = []
                for (let j = 0; j < personal.commentList.length; j++) {
                    const user = await User.find({ _id: { $in: personal.commentList[j].listTag } }, { userName: 1, _id: 1, avatarUser: 1 })
                    if (user.avatarUser !== '') {
                        user.avatarUser = `${urlImgHost()}/avatarUser/${user._id}/${user.avatarUser}`
                    } else {
                        user.avatarUser = `${urlImgHost()}/avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                    }
                    personal._doc.commentList[j].listTag = user

                    if (!personal.commentList[j].IdImage && !personal.commentList[j].IdVideo) {
                        totalCommnet += 1

                    } else if (personal.commentList[j].IdImage) {

                        comment.push({
                            id: personal.commentList[j].IdImage,
                        })

                    } else if (personal.commentList[j].IdVideo) {

                        comment.push({
                            id: personal.commentList[j].IdVideo,
                        })
                    }
                }

                for (let j = 0; j < personal.imageList.length; j++) {

                    let count = comment.filter(item => item.id == personal.imageList[j]._id).length;

                    if (count >= 0) {
                        personal.imageList[j]._doc.totalComment = count
                    } else {
                        personal.imageList[j]._doc.totalComment = 0
                    }

                }
                personal._doc.totalCommnet = totalCommnet

                for (let j = 0; j < personal.videoList.length; j++) {

                    let count = comment.filter(item => item.id == personal.videoList[j]._id).length;

                    if (count >= 0) {
                        personal.videoList[j]._doc.totalComment = count
                    } else {
                        personal.videoList[j]._doc.totalComment = 0
                    }

                }

                // socket.emit("releasePost", result._doc, message, user, diary.userSender)
                res.status(200).json({
                    data: {
                        result: result._doc,
                        message: "Success",
                    },
                    error: null,
                });

                if(personal.emotion.includes(user._id) && Number(personal.userId) != Number(user._id)) {
                    axios({
                        method: "post",
                        url: "http://43.239.223.142:9000/api/V2/Notification/SendNotification",
                        data: {
                            Title: "Thông báo trang cá nhân mới",
                            Message: `${user.userName} đã thả cảm xúc bài viết của bạn`,
                            Type: "SendCandidate",
                            UserId: personal.userId
                        },
                        headers: { "Content-Type": "multipart/form-data" }
                    }).catch((e) => {
                        console.log(e)
                    })
                } 
            } else {
                res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
            }
        } else {
            res
                .status(200)
                .json(createError(200, "Thông tin truyền lên không đầy đủ"));
        }
    } catch (err) {
        console.log(err);
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
};

//đếm tổng số ảnh và tổng số video trong tất cả album
export const countFile = async (req, res, next) => {
    try {
        if (req.params.token) {
            let check = await checkToken(req.params.token);
            if (check && check.status && (check.userId == req.params.userId)) {
                console.log("Token hop le, countFile")
            } else {
                return res.status(404).json(createError(404, "Invalid token"));
            }
        }
        if (req && req.params && req.params.userId) {
            const userId = req.params.userId;
            const count = await Personal.find({ userId: Number(userId) }).sort({
                createAt: "desc",
            }).lean();
            // const count = await Personal.find({ userId: Number(userId), contentPost: { $exists: true } }).sort({
            //     createAt: "desc",
            // }).lean();

            if (count) {
                let totalImage = 0;
                let totalVideo = 0;
                let linkbackgroundImg
                for (let i = 0; i < count.length; i++) {
                    totalImage += count[i].imageList.length;
                    totalVideo += count[i].videoList.length;
                }

                for (let i = 0; i < count.length; i++) {

                    if (count[i].backgroundImage[0] && count[i].backgroundImage[0].pathFile) {
                        linkbackgroundImg = count[i].backgroundImage[0].pathFile = `${urlImgHostwf()}Testnode/public/personalBackgroundImg/${count[i].backgroundImage[0].pathFile}`
                        break
                    } else linkbackgroundImg = ""
                }

                const user = await User.findOne({ _id: Number(userId) }, { description: 1 })
                const result = {
                    totalImage: totalImage,
                    totalVideo: totalVideo,
                    linkbackgroundImg: linkbackgroundImg || '',
                    description: user.description || ''

                };
                res.status(200).json({
                    data: {
                        result: result,
                        message: "Lấy thông tin thành công",
                    },
                    error: null,
                });
            } else {
                res.status(200).json(createError(200, "Id không chính xác"));
            }
        } else {
            res.status(200).json(createError(200, "Chưa truyền đủ dữ liệu"));
        }
    } catch (err) {
        console.log(err);
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
};

//thêm, đếm số like vào ảnh và video và comment đã đăng
export const emotionFile = async(req, res, next) => {
    try {
        if (req.body.token) {
            let check = await checkToken(req.body.token);
            if (check && check.status && (check.userId == req.body.userSendId)) {
                console.log("Token hop le, emotionFile")
            } else {
                return res.status(404).json(createError(404, "Invalid token"));
            }
        }
        if (
            req.body &&
            String(req.body.type) &&
            req.body.userSendId &&
            Number(req.body.userSendId)
        ) {

            let totalCommnet = 0
            let comment = []
            const user = await User.findOne({ _id: Number(req.body.userSendId) }, { userName: 1, avatarUser: 1 });
            let result
            let findPost = await Personal.findOne({_id: req.body._id},{userId:1}).lean()
            if (String(req.body.type) === "1") {
                const formData = {...req.body };
                let totalImageEmotion = 0

                // if (user.avatarUser !== '') {
                //     user.avatarUser = `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`
                // }
                // else {
                //     user.avatarUser = `${urlImgHostwf()}avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                // }
                result = await Personal.aggregate([{
                        $match: {
                            _id: ObjectId(req.body._id),
                        },
                    },
                    {
                        $project: {
                            imageList: {
                                $slice: [
                                    // để giới hạn kết quả trả về
                                    {
                                        $filter: {
                                            input: "$imageList",
                                            as: "imagelist",
                                            cond: {
                                                $eq: ["$$imagelist._id", ObjectId(req.body.imageId)],
                                            },
                                        },
                                    }, -10,
                                ],
                            },
                        },
                    },
                ]);

                if (result) {
                    let ListUserLike = result[0].imageList[0].imageEmotion;
                    let UserLikeName = result[0].imageList[0].imageLikeName;
                    let UserLikeAvatar = result[0].imageList[0].imageLikeAvatar;

                    const ar = ListUserLike.split(",");
                    const arname = UserLikeName.split(",");
                    const aravatar = UserLikeAvatar.split(",");
                    if (ar.includes(String(req.body.userSendId))) {
                        ar.splice(ar.indexOf(String(req.body.userSendId)), 1);
                        ListUserLike = ar.join(",");
                        if (user.avatarUser !== "") {
                            aravatar.splice(
                                ar.indexOf(
                                    `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`
                                ),
                                1
                            );
                        } else {
                            aravatar.splice(
                                aravatar.indexOf(
                                    `${urlImgHostwf()}avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1
                  }.png`
                                ),
                                1
                            );
                        }
                        UserLikeAvatar = aravatar.join(",");
                        arname.splice(arname.indexOf(String(user.username)), 1);
                        UserLikeName = arname.join(",");
                    } else {
                        ar.push(String(req.body.userSendId));

                        if (user.avatarUser !== "") {
                            aravatar.push(
                                `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`
                            );
                        } else {
                            aravatar.push(
                                `${urlImgHostwf()}avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1
                }.png`
                            );
                        }
                        arname.push(String(user.userName));
                        ListUserLike = ar.join(",");
                        UserLikeName = arname.join(",");
                        UserLikeAvatar = aravatar.join(",");
                    }

                    if (ListUserLike) {
                        totalImageEmotion = ListUserLike.split(",").length - 1;
                    }

                    let update = await Personal.findOneAndUpdate({
                        _id: String(req.body._id),
                        "imageList._id": String(req.body.imageId),
                    }, {
                        $set: {
                            "imageList.$.imageEmotion": ListUserLike,
                            "imageList.$.imageLikeName": UserLikeName,
                            "imageList.$.imageLikeAvatar": UserLikeAvatar,
                        },
                    }, { new: true });

                    if (update && update.IdAlbum && update.IdAlbum != "") {
                        await Personal.findOneAndUpdate({
                            _id: String(update.IdAlbum),
                            "imageList._id": String(req.body.imageId),
                        }, {
                            $set: {
                                "imageList.$.imageEmotion": ListUserLike,
                                "imageList.$.imageLikeName": UserLikeName,
                                "imageList.$.imageLikeAvatar": UserLikeAvatar,
                            },
                        }, { new: true });
                    } else {
                        let findPostUserAlbum = await Personal.find({
                            IdAlbum: update._id
                        }, { _id: 1 }).lean()
                        if (findPostUserAlbum && findPostUserAlbum.length > 0) {
                            await Personal.updateMany({
                                _id: { $in: findPostUserAlbum },
                                "imageList._id": String(req.body.imageId),
                            }, {
                                $set: {
                                    "imageList.$.imageEmotion": ListUserLike,
                                    "imageList.$.imageLikeName": UserLikeName,
                                    "imageList.$.imageLikeAvatar": UserLikeAvatar,
                                },
                            }, { new: true });
                        }
                    }

                    if (update) {
                        for (let i = 0; i < update.imageList.length; i++) {
                            update.imageList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${update.imageList[i].pathFile}`
                        }
                        for (let i = 0; i < update.videoList.length; i++) {
                            update.videoList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].pathFile}`
                            update.videoList[i].thumbnailName = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].thumbnailName}`
                        }
                        const result = {...update };
                        result._doc.totalImageEmotion = totalImageEmotion;
                        if (update.emotion) {
                            result._doc.totalEmotion = update.emotion.split("/").length - 1;
                        } else {
                            result._doc.totalEmotion = 0;
                        }

                        for (let j = 0; j < update.commentList.length; j++) {
                            const user = await User.find({ _id: { $in: update.commentList[j].listTag } }, { userName: 1, _id: 1, avatarUser: 1 })
                            if (user.avatarUser !== '') {
                                user.avatarUser = `${urlImgHost()}/avatarUser/${user._id}/${user.avatarUser}`
                            } else {
                                user.avatarUser = `${urlImgHost()}/avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                            }
                            update._doc.commentList[j].listTag = user

                            if (!update.commentList[j].IdImage && !update.commentList[j].IdVideo) {
                                totalCommnet += 1

                            } else if (update.commentList[j].IdImage) {

                                comment.push({
                                    id: update.commentList[j].IdImage,
                                })

                            } else if (update.commentList[j].IdVideo) {

                                comment.push({
                                    id: update.commentList[j].IdVideo,
                                })
                            }
                        }

                        for (let j = 0; j < update.imageList.length; j++) {

                            let count = comment.filter(item => item.id == update.imageList[j]._id).length;

                            if (count >= 0) {
                                update.imageList[j]._doc.totalComment = count
                            } else {
                                update.imageList[j]._doc.totalComment = 0
                            }

                        }
                        result._doc.totalCommnet = totalCommnet

                        for (let j = 0; j < update.videoList.length; j++) {

                            let count = comment.filter(item => item.id == update.videoList[j]._id).length;

                            if (count >= 0) {
                                update.videoList[j]._doc.totalComment = count
                            } else {
                                update.videoList[j]._doc.totalComment = 0
                            }

                        }

                        res.status(200).json({
                            data: {
                                result: result._doc,
                                message: "thành công",
                            },
                            error: null,
                        });

                        let findImageIndex = update.imageList.findIndex(
                            (e) => e._id == String(req.body.imageId)
                        )

                        if(findImageIndex >=0 && update.imageList[findImageIndex].imageEmotion.includes(req.body.userSendId) 
                            && Number(user._id) != Number(findPost.userId)){
                            axios({
                                method: "post",
                                url: "http://43.239.223.142:9000/api/V2/Notification/SendNotification",
                                data: {
                                    Title: "Thông báo trang cá nhân mới",
                                    Message: `${user.userName} đã thả cảm xúc ảnh của bạn`,
                                    Type: "SendCandidate",
                                    UserId: findPost.userId
                                },
                                headers: { "Content-Type": "multipart/form-data" }
                            }).catch((e) => {
                                console.log(e)
                            })
                        }   
                    }
                }
            }

            if (String(req.body.type) === "2") {
                let totalVideoEmotion = 0
                result = await Personal.aggregate([{
                        $match: {
                            _id: ObjectId(req.body._id),
                        },
                    },
                    {
                        $project: {
                            videoList: {
                                $slice: [
                                    // để giới hạn kết quả trả về
                                    {
                                        $filter: {
                                            input: "$videoList",
                                            as: "videolist",
                                            cond: {
                                                $eq: ["$$videolist._id", ObjectId(req.body.videoId)],
                                            },
                                        },
                                    }, -10,
                                ],
                            },
                        },
                    },
                ]);

                if (result) {
                    let ListUserLike = result[0].videoList[0].videoEmotion;
                    let UserLikeName = result[0].videoList[0].videoLikeName;
                    let UserLikeAvatar = result[0].videoList[0].videoLikeAvatar;

                    const ar = ListUserLike.split(",");
                    const arname = UserLikeName.split(",");
                    const aravatar = UserLikeAvatar.split(",");
                    if (ar.includes(String(req.body.userSendId))) {
                        ar.splice(ar.indexOf(String(req.body.userSendId)), 1);
                        ListUserLike = ar.join(",");
                        if (user.avatarUser !== "") {
                            aravatar.splice(
                                ar.indexOf(
                                    `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`
                                ),
                                1
                            );
                        } else {
                            aravatar.splice(
                                aravatar.indexOf(
                                    `${urlImgHostwf()}avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1
                  }.png`
                                ),
                                1
                            );
                        }
                        UserLikeAvatar = aravatar.join(",");
                        arname.splice(arname.indexOf(String(user.userName)), 1);
                        UserLikeName = arname.join(",");
                    } else {
                        ar.push(String(req.body.userSendId));

                        if (user.avatarUser !== "") {
                            aravatar.push(
                                `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`
                            );
                        } else {
                            aravatar.push(
                                `${urlImgHostwf()}avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1
                }.png`
                            );
                        }
                        arname.push(String(user.userName));
                        ListUserLike = ar.join(",");
                        UserLikeName = arname.join(",");
                        UserLikeAvatar = aravatar.join(",");
                    }
                    if (ListUserLike) {
                        totalVideoEmotion = ListUserLike.split(",").length - 1;
                    }

                    let update = await Personal.findOneAndUpdate({
                        _id: String(req.body._id),
                        "videoList._id": String(req.body.videoId),
                    }, {
                        $set: { "videoList.$.videoEmotion": ListUserLike },
                        "videoList.$.videoLikeName": UserLikeName,
                        "videoList.$.videoLikeAvatar": UserLikeAvatar,
                    }, { new: true });

                    if (update && update.IdAlbum && update.IdAlbum != "") {
                        await Personal.findOneAndUpdate({
                            _id: String(update.IdAlbum),
                            "videoList._id": String(req.body.videoId),
                        }, {
                            $set: { "videoList.$.videoEmotion": ListUserLike },
                            "videoList.$.videoLikeName": UserLikeName,
                            "videoList.$.videoLikeAvatar": UserLikeAvatar,
                        }, { new: true });
                    } else {
                        let findPostUserAlbum = await Personal.find({
                            IdAlbum: update._id
                        }, { _id: 1 }).lean()
                        if (findPostUserAlbum && findPostUserAlbum.length > 0) {
                            await Personal.updateMany({
                                _id: { $in: findPostUserAlbum },
                                "videoList._id": String(req.body.videoId),
                            }, {
                                $set: {
                                    "videoList.$.videoEmotion": ListUserLike,
                                    "videoList.$.videoLikeName": UserLikeName,
                                    "videoList.$.videoLikeAvatar": UserLikeAvatar,
                                },
                            }, { new: true });
                        }
                    }

                    if (update) {
                        for (let i = 0; i < update.imageList.length; i++) {
                            update.imageList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${update.imageList[i].pathFile}`
                        }
                        for (let i = 0; i < update.videoList.length; i++) {
                            update.videoList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].pathFile}`
                            update.videoList[i].thumbnailName = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].thumbnailName}`
                        }
                        const result = {...update };
                        result._doc.totalVideoEmotion = totalVideoEmotion;
                        if (update.emotion) {
                            result._doc.totalEmotion = update.emotion.split("/").length - 1;
                        } else {
                            result._doc.totalEmotion = 0;
                        }


                        for (let j = 0; j < update.commentList.length; j++) {
                            const user = await User.find({ _id: { $in: update.commentList[j].listTag } }, { userName: 1, _id: 1, avatarUser: 1 })
                            if (user.avatarUser !== '') {
                                user.avatarUser = `${urlImgHost()}/avatarUser/${user._id}/${user.avatarUser}`
                            } else {
                                user.avatarUser = `${urlImgHost()}/avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                            }
                            update._doc.commentList[j].listTag = user

                            if (!update.commentList[j].IdImage && !update.commentList[j].IdVideo) {
                                totalCommnet += 1

                            } else if (update.commentList[j].IdImage) {

                                comment.push({
                                    id: update.commentList[j].IdImage,
                                })

                            } else if (update.commentList[j].IdVideo) {

                                comment.push({
                                    id: update.commentList[j].IdVideo,
                                })
                            }
                        }

                        for (let j = 0; j < update.imageList.length; j++) {

                            let count = comment.filter(item => item.id == update.imageList[j]._id).length;

                            if (count >= 0) {
                                update.imageList[j]._doc.totalComment = count
                            } else {
                                update.imageList[j]._doc.totalComment = 0
                            }

                        }
                        result._doc.totalCommnet = totalCommnet

                        for (let j = 0; j < update.videoList.length; j++) {

                            let count = comment.filter(item => item.id == update.videoList[j]._id).length;

                            if (count >= 0) {
                                update.videoList[j]._doc.totalComment = count
                            } else {
                                update.videoList[j]._doc.totalComment = 0
                            }

                        }

                        res.status(200).json({
                            data: {
                                result: result._doc,
                                message: "thành công",
                            },
                            error: null,
                        });

                        let findVideoIndex = update.videoList.findIndex(
                            (e) => e._id == String(req.body.videoId)
                        )
                            console.log(findVideoIndex)
                        if(findVideoIndex >=0 && update.videoList[findVideoIndex].videoEmotion.includes(req.body.userSendId)
                        && Number(user._id) != Number(findPost.userId)){
                            axios({
                                method: "post",
                                url: "http://43.239.223.142:9000/api/V2/Notification/SendNotification",
                                data: {
                                    Title: "Thông báo trang cá nhân mới",
                                    Message: `${user.userName} đã thả cảm xúc video của bạn`,
                                    Type: "SendCandidate",
                                    UserId: findPost.userId
                                },
                                headers: { "Content-Type": "multipart/form-data" }
                            }).catch((e) => {
                                console.log(e)
                            })
                        }
                    }
                }
            }

            if (String(req.body.type) === "3") {
                let totalCommentEmotion = 0
                result = await Personal.aggregate([{
                        $match: {
                            _id: ObjectId(req.body._id),
                        },
                    },
                    {
                        $project: {
                            commentList: {
                                $slice: [
                                    // để giới hạn kết quả trả về
                                    {
                                        $filter: {
                                            input: "$commentList",
                                            as: "commentlist",
                                            cond: {
                                                $eq: [
                                                    "$$commentlist._id",
                                                    ObjectId(req.body.commentId),
                                                ],
                                            },
                                        },
                                    }, -10,
                                ],
                            },
                        },
                    },
                ]);

                if (result) {
                    let ListUserLike = result[0].commentList[0].commentEmotion;
                    let UserLikeName = result[0].commentList[0].commentLikeName;
                    let UserLikeAvatar = result[0].commentList[0].commentLikeAvatar;

                    const ar = ListUserLike.split(",");
                    const arname = UserLikeName.split(",");
                    const aravatar = UserLikeAvatar.split(",");
                    if (ar.includes(String(req.body.userSendId))) {
                        ar.splice(ar.indexOf(String(req.body.userSendId)), 1);
                        ListUserLike = ar.join(",");
                        if (user.avatarUser !== "") {
                            aravatar.splice(
                                ar.indexOf(
                                    `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`
                                ),
                                1
                            );
                        } else {
                            aravatar.splice(
                                aravatar.indexOf(
                                    `${urlImgHostwf()}avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1
                  }.png`
                                ),
                            );
                        }
                        UserLikeAvatar = aravatar.join(",");
                        arname.splice(arname.indexOf(String(user.userName)), 1);
                        UserLikeName = arname.join(",");
                    } else {
                        ar.push(String(req.body.userSendId));

                        if (user.avatarUser !== "") {
                            aravatar.push(
                                `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`
                            );
                        } else {
                            aravatar.push(
                                `${urlImgHostwf()}avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1
                }.png`
                            );
                        }
                        arname.push(String(user.userName));
                        ListUserLike = ar.join(",");
                        UserLikeName = arname.join(",");
                        UserLikeAvatar = aravatar.join(",");
                    }
                    if (ListUserLike) {
                        totalCommentEmotion = ListUserLike.split(",").length - 1;
                    }

                    let update = await Personal.findOneAndUpdate({
                        _id: String(req.body._id),
                        "commentList._id": String(req.body.commentId),
                    }, {
                        $set: { "commentList.$.commentEmotion": ListUserLike },
                        "commentList.$.commentLikeName": UserLikeName,
                        "commentList.$.commentLikeAvatar": UserLikeAvatar,
                    }, { new: true });

                    if (update && update.IdAlbum && update.IdAlbum != "") {
                        await Personal.findOneAndUpdate({
                            _id: String(update.IdAlbum),
                            "commentList._id": String(req.body.commentId),
                        }, {
                            $set: { "commentList.$.commentEmotion": ListUserLike },
                            "commentList.$.commentLikeName": UserLikeName,
                            "commentList.$.commentLikeAvatar": UserLikeAvatar,
                        }, { new: true });
                    } else {
                        let findPostUserAlbum = await Personal.find({
                            IdAlbum: update._id
                        }, { _id: 1 }).lean()
                        if (findPostUserAlbum && findPostUserAlbum.length > 0) {
                            await Personal.updateMany({
                                _id: { $in: findPostUserAlbum },
                                "commentList._id": String(req.body.commentId),
                            }, {
                                $set: {
                                    "commentList.$.commentEmotion": ListUserLike,
                                    "commentList.$.commentLikeName": UserLikeName,
                                    "commentList.$.commentLikeAvatar": UserLikeAvatar,
                                },
                            }, { new: true });
                        }
                    }

                    if (update) {
                        for (let i = 0; i < update.imageList.length; i++) {
                            update.imageList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${update.imageList[i].pathFile}`
                        }
                        for (let i = 0; i < update.videoList.length; i++) {
                            update.videoList[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].pathFile}`
                            update.videoList[i].thumbnailName = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${update.videoList[i].thumbnailName}`
                        }
                        const result = {...update };
                        result._doc.totalcommentEmotion = totalCommentEmotion;
                        if (update.emotion) {
                            result._doc.totalEmotion = update.emotion.split("/").length - 1;
                        } else {
                            result._doc.totalEmotion = 0;
                        }

                        for (let j = 0; j < update.commentList.length; j++) {
                            const user = await User.find({ _id: { $in: update.commentList[j].listTag } }, { userName: 1, _id: 1, avatarUser: 1 })
                            if (user.avatarUser !== '') {
                                user.avatarUser = `${urlImgHost()}/avatarUser/${user._id}/${user.avatarUser}`
                            } else {
                                user.avatarUser = `${urlImgHost()}/avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                            }
                            update._doc.commentList[j].listTag = user

                            if (!update.commentList[j].IdImage && !update.commentList[j].IdVideo) {
                                totalCommnet += 1

                            } else if (update.commentList[j].IdImage) {

                                comment.push({
                                    id: update.commentList[j].IdImage,
                                })

                            } else if (update.commentList[j].IdVideo) {

                                comment.push({
                                    id: update.commentList[j].IdVideo,
                                })
                            }
                        }

                        for (let j = 0; j < update.imageList.length; j++) {

                            let count = comment.filter(item => item.id == update.imageList[j]._id).length;

                            if (count >= 0) {
                                update.imageList[j]._doc.totalComment = count
                            } else {
                                update.imageList[j]._doc.totalComment = 0
                            }

                        }
                        result._doc.totalCommnet = totalCommnet

                        for (let j = 0; j < update.videoList.length; j++) {

                            let count = comment.filter(item => item.id == update.videoList[j]._id).length;

                            if (count >= 0) {
                                update.videoList[j]._doc.totalComment = count
                            } else {
                                update.videoList[j]._doc.totalComment = 0
                            }

                        }

                        res.status(200).json({
                            data: {
                                result: result._doc,
                                message: "thành công",
                            },
                            error: null,
                        });

                        let findCommentIndex = update.commentList.findIndex(
                            (e) => e._id == String(req.body.commentId)
                        )
                            console.log(findCommentIndex)
                        if(findCommentIndex >=0 && update.commentList[findCommentIndex].commentEmotion.includes(req.body.userSendId)
                        && Number(user._id) != Number(findPost.userId)){
                            axios({
                                method: "post",
                                url: "http://43.239.223.142:9000/api/V2/Notification/SendNotification",
                                data: {
                                    Title: "Thông báo trang cá nhân mới",
                                    Message: `${user.userName} đã thả cảm xúc comment của bạn`,
                                    Type: "SendCandidate",
                                    UserId: findPost.userId
                                },
                                headers: { "Content-Type": "multipart/form-data" }
                            }).catch((e) => {
                                console.log(e)
                            })
                        }
                    }
                }
            }

            if (String(req.body.type) === "4") {
                let totalCommentEmotion = 0
                result = await Diary.aggregate([{
                        $match: {
                            _id: ObjectId(req.body._id),
                        },
                    },
                    {
                        $project: {
                            commentList: {
                                $slice: [
                                    // để giới hạn kết quả trả về
                                    {
                                        $filter: {
                                            input: "$commentList",
                                            as: "commentlist",
                                            cond: {
                                                $eq: [
                                                    "$$commentlist._id",
                                                    ObjectId(req.body.commentId),
                                                ],
                                            },
                                        },
                                    }, -10,
                                ],
                            },
                        },
                    },
                ]);

                if (result) {
                    let ListUserLike = result[0].commentList[0].commentEmotion;
                    let UserLikeName = result[0].commentList[0].commentLikeName;
                    let UserLikeAvatar = result[0].commentList[0].commentLikeAvatar;

                    const ar = ListUserLike.split(",");
                    const arname = UserLikeName.split(",");
                    const aravatar = UserLikeAvatar.split(",");
                    if (ar.includes(String(req.body.userSendId))) {
                        ar.splice(ar.indexOf(String(req.body.userSendId)), 1);
                        ListUserLike = ar.join(",");
                        if (user.avatarUser !== "") {
                            aravatar.splice(
                                ar.indexOf(
                                    `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`
                                ),
                                1
                            );
                        } else {
                            aravatar.splice(
                                aravatar.indexOf(
                                    `${urlImgHostwf()}avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1
                  }.png`
                                ),
                            );
                        }
                        UserLikeAvatar = aravatar.join(",");
                        arname.splice(arname.indexOf(String(user.userName)), 1);
                        UserLikeName = arname.join(",");
                    } else {
                        ar.push(String(req.body.userSendId));

                        if (user.avatarUser !== "") {
                            aravatar.push(
                                `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`
                            );
                        } else {
                            aravatar.push(
                                `${urlImgHostwf()}avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1
                }.png`
                            );
                        }
                        arname.push(String(user.userName));
                        ListUserLike = ar.join(",");
                        UserLikeName = arname.join(",");
                        UserLikeAvatar = aravatar.join(",");
                    }
                    if (ListUserLike) {
                        totalCommentEmotion = ListUserLike.split(",").length - 1;
                    }

                    let update = await Diary.findOneAndUpdate({
                        _id: String(req.body._id),
                        "commentList._id": String(req.body.commentId),
                    }, {
                        $set: { "commentList.$.commentEmotion": ListUserLike },
                        "commentList.$.commentLikeName": UserLikeName,
                        "commentList.$.commentLikeAvatar": UserLikeAvatar,
                    }, { new: true });
                    if (update) {
                        const result = {...update };
                        result._doc.totalcommentEmotion = totalCommentEmotion;

                        for (let j = 0; j < update.commentList.length; j++) {
                            const user = await User.find({ _id: { $in: update.commentList[j].listTag } }, { userName: 1, _id: 1, avatarUser: 1 })
                            if (user.avatarUser !== '') {
                                user.avatarUser = `${urlImgHost()}/avatarUser/${user._id}/${user.avatarUser}`
                            } else {
                                user.avatarUser = `${urlImgHost()}/avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                            }
                            update._doc.commentList[j].listTag = user

                            if (!update.commentList[j].IdImage && !update.commentList[j].IdVideo) {
                                totalCommnet += 1

                            } else if (update.commentList[j].IdImage) {

                                comment.push({
                                    id: update.commentList[j].IdImage,
                                })

                            } else if (update.commentList[j].IdVideo) {

                                comment.push({
                                    id: update.commentList[j].IdVideo,
                                })
                            }
                        }

                        for (let j = 0; j < update.imageList.length; j++) {

                            let count = comment.filter(item => item.id == update.imageList[j]._id).length;

                            if (count >= 0) {
                                update.imageList[j]._doc.totalComment = count
                            } else {
                                update.imageList[j]._doc.totalComment = 0
                            }

                        }
                        result._doc.totalCommnet = totalCommnet

                        for (let j = 0; j < update.videoList.length; j++) {

                            let count = comment.filter(item => item.id == update.videoList[j]._id).length;

                            if (count >= 0) {
                                update.videoList[j]._doc.totalComment = count
                            } else {
                                update.videoList[j]._doc.totalComment = 0
                            }

                        }

                        res.status(200).json({
                            data: {
                                result: result._doc,
                                message: "thành công",
                            },
                            error: null,
                        });

                        let findCommentIndex = update.commentList.findIndex(
                            (e) => e._id == String(req.body.commentId)
                        )
                            console.log(findCommentIndex)
                        if(findCommentIndex >=0 && update.commentList[findCommentIndex].commentEmotion.includes(req.body.userSendId)
                         && Number(user._id) != Number(findPost.userId)){
                            axios({
                                method: "post",
                                url: "http://43.239.223.142:9000/api/V2/Notification/SendNotification",
                                data: {
                                    Title: "Thông báo nhật ký chung mới",
                                    Message: `${user.userName} đã thả cảm xúc comment của bạn`,
                                    Type: "SendCandidate",
                                    UserId: findPost.userId
                                },
                                headers: { "Content-Type": "multipart/form-data" }
                            }).catch((e) => {
                                console.log(e)
                            })
                        }
                    }
                }
            }

        } else {
            res
                .status(200)
                .json(createError(200, "Thông tin truyền lên không đầy đủ"));
        }
    } catch (e) {
        console.log(e);
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
};

// gắn thẻ người xem
export const tagPersonal = async(req, res, next) => {
    try {
        if (req.body.token) {
            let check = await checkToken(req.body.token);
            if (check && check.status && (check.userId == req.body.userId)) {
                console.log("Token hop le, tagPersonal")
            } else {
                return res.status(404).json(createError(404, "Invalid token"));
            }
        }
        if (req && req.body && req.body.listTag) {
            const formData = {...req.body };
            const user = await User.findOne({ _id: req.body.userId }, { userName: 1, avatarUser: 1 })

            const updatetag = await Personal.findOneAndUpdate({ _id: String(req.body.id) }, { listTag: formData.listTag }, { new: true });
            let tag = [];
            if (updatetag) {
                if (!req.body.listTag.includes("[")) {
                    tag = req.body.listTag;
                } else {
                    let string = String(req.body.listTag).replace("[", "");
                    string = String(string).replace("]", "");
                    let list = string.split(",");
                    for (let i = 0; i < list.length; i++) {
                        if (Number(list[i])) {
                            tag.push(Number(list[i]));
                        }
                    }
                }
            }

            for (let i = 0; i < tag.length; i++) {
                const find = await User.find({ _id: tag[i] }, { userName: 1, avatarUser: 1 })
                    // console.log(find)
                if (find[0].avatarUser !== "") {
                    find[0].avatarUser = `${urlImgHostwf()}avatarUser/${find[0]._id}/${find[0].avatarUser}`;
                } else {
                    find[0].avatarUser = `${find[0]._id}`;
                }
                if (find && !updatetag.tagName.includes(find[0].userName) && !updatetag.tagAvatar.includes(find[0].avatarUser)) {
                    const update = await Personal.findOneAndUpdate({ _id: String(req.body.id) }, {
                        $push: { tagName: find[0].userName, tagAvatar: find[0].avatarUser }
                    }, { new: true })
                }

            }


            const findinfo = await Personal.findOne({ _id: req.body.id })

            for (let i = 0; i < tag.length; i++) {
                axios({
                    method: "post",
                    url: "http://43.239.223.142:9000/api/V2/Notification/SendNotification",
                    data: {
                        Title: "Thông báo gắn thẻ",
                        Message: `Bạn đã được gắn thẻ bới ${user.userName}`,
                        Type: "SendCandidate",
                        UserId: tag[i]
                    },
                    headers: { "Content-Type": "multipart/form-data" }
                }).catch((e) => {
                    console.log(e)
                })
            }
            res.status(200).json({
                data: {
                    result: findinfo,
                    message: "Success",
                },
                error: null,
            });
        } else
            res.status(200).json(createError(200, "Thông tin truyền lên không đúng"));
    } catch (err) {
        console.log(err);
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
};

//gỡ thẻ người xem
export const untagPersonal = async(req, res, next) => {
    try {
        if (req.body.token) {
            let check = await checkToken(req.body.token);
            if (check && check.status) {
                console.log("Token hop le, untagPersonal")
            } else {
                return res.status(404).json(createError(404, "Invalid token"));
            }
        }
        if (req && req.body && req.body.listunTag) {
            const formData = {...req.body };
            const listTag = await Personal.findOne({ _id: req.body.id })
            let untag = [];
            let list
            if (!req.body.listunTag.includes("[")) {
                untag = req.body.listunTag;
            } else {
                let string = String(req.body.listunTag).replace("[", "");
                string = String(string).replace("]", "");
                list = string.split(",");
            }


            let listfinal = ''
            for (let i = 0; i < list.length; i++) {

                listTag.listTag = listTag.listTag.replace(list[i], "")
                listfinal = listTag.listTag

            }

            listfinal = listfinal.replace("[", "")
            listfinal = listfinal.replace("]", "")
            let listfinal1 = listfinal.split(",")

            let result = ""
            listfinal1 = listfinal1.filter((e) => e !== '').join(',')
            let listfinal2 = listfinal1.split(",")
            if (listfinal1) {
                result = "[" + listfinal1 + "]";
            }


            let name = []
            let avatar = []
            if (listfinal1) {
                for (let i = 0; i < listfinal2.length; i++) {
                    const find = await User.find({ _id: listfinal2[i] }, { userName: 1, avatarUser: 1 })
                    if (find[0].avatarUser !== "") {
                        find[0].avatarUser = `${urlImgHostwf()}avatarUser/${find[0]._id}/${find[0].avatarUser}`;
                    } else {
                        find[0].avatarUser = `${find[0]._id}`;
                    }

                    name.push(find[0].userName)
                    avatar.push(find[0].avatarUser)

                }
            }

            const listFinalUpdate = await Personal.findOneAndUpdate({ _id: req.body.id }, { listTag: result, tagName: name, tagAvatar: avatar }, { new: true })

            if (listFinalUpdate) {

                res.status(200).json({
                    data: {
                        result: listFinalUpdate,
                        message: "Success",
                    },
                    error: null,
                })
            } else {
                res.status(200).json(createError(200, "Đã có lỗi"));
            }
        } else
            res.status(200).json(createError(200, "Thông tin truyền lên không đúng"));
    } catch (err) {
        console.log(err);
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
};

//hiện thị tất cả ảnh 
export const GetListLibra = async(req, res, next) => {
    try {

        if (req && req.body && req.body.userId && req.body.index && req.body.type) {
            let Image = []
            let Video = []

            let post = await Personal.aggregate([{
                '$match': {
                    'userId': Number(req.body.userId)
                }
            }, {
                '$addFields': {
                    'createAt': {
                        '$dateToString': {
                            'date': '$createAt',
                            'timezone': '+07:00',
                            'format': '%G-%m-%d'
                        }
                    }
                }
            }, {
                '$group': {
                    '_id': '$createAt',
                    'imageList': {
                        '$push': '$imageList'
                    },
                    'videoList': {
                        '$push': '$videoList'
                    }
                }
            }, {
                '$addFields': {
                    'createAt': '$_id',
                    'imageList': {
                        '$reduce': {
                            'input': '$imageList',
                            'initialValue': [],
                            'in': {
                                '$concatArrays': [
                                    '$$value', '$$this'
                                ]
                            }
                        }
                    },
                    'videoList': {
                        '$reduce': {
                            'input': '$videoList',
                            'initialValue': [],
                            'in': {
                                '$concatArrays': [
                                    '$$value', '$$this'
                                ]
                            }
                        }
                    }
                }
            }, {
                '$sort': {
                    '_id': -1
                }
            }])

            for (let i = 0; i < post.length; i++) {
                if (post[i].imageList.length > 0 && req.body.type === 'image') {
                    const path = []
                    for (let j = 0; j < post[i].imageList.length; j++) {
                        post[i].imageList[
                            j
                        ].pathFile = `${urlImgHost()}personalUpload/personalImage/${post[i].imageList[j].pathFile}`;
                        path.push(post[i].imageList[j].pathFile)
                    }
                    Image.push({
                        createAt: post[i].createAt,
                        path
                    })
                }
                if (post[i].videoList.length > 0 && req.body.type === 'video') {
                    const path = []
                    for (let j = 0; j < post[i].videoList.length; j++) {
                        post[i].videoList[
                            j
                        ].pathFile = `${urlImgHost()}personalUpload/personalVideo/${post[i].videoList[j].pathFile}`;
                        post[i].videoList[
                            j
                        ].thumbnailName = `${urlImgHost()}personalUpload/personalVideo/${post[i].videoList[j].thumbnailName}`;
                        path.push({
                            video: post[i].videoList[j].pathFile,
                            thumbnail: post[i].videoList[j].thumbnailName,
                        })
                    }
                    Video.push({
                        createAt: post[i].createAt,
                        path
                    })
                }
            }

            Image = Image.slice(Number(req.body.index), Number(req.body.index) + 20)
                // Video = Video.slice(Number(req.body.index), Number(req.body.index) + 20)

            if (post) {
                res.status(200).json({
                    data: {
                        imageList: Image,
                        videoList: Video,
                        message: "Success",
                    },
                    error: null,
                })
            } else {
                res.status(200).json(createError(200, "Đã có lỗi"));
            }
        } else {
            res.status(200).json(createError(200, "Thiếu thông tin truyền lên"));
        }
    } catch (err) {
        console.error(err)
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
}

export const GetListLibraApp = async(req, res, next) => {
    try {
        if (req && req.body && req.body.userId && req.body.type) {
            let image = []
            let video = []

            let post = await Personal.aggregate([{
                '$match': {
                    'userId': Number(req.body.userId),
                    'contentPost': { $exists: true }
                }
            }, {
                $sort: {
                    createAt: -1,
                },
            }, {
                '$project': {
                    '_id': 1,
                    'imageList': 1,
                    'videoList': 1,
                    'createAt': 1,
                    'contentPost': 1,
                    'commentList': 1
                }
            }, {
                '$addFields': {
                    'createAt': {
                        '$dateToString': {
                            'date': '$createAt',
                            'timezone': '+07:00',
                            'format': '%G-%m-%d'
                        }
                    }
                }
            }, {
                '$addFields': {
                    'imageList': {
                        '$map': {
                            'input': { '$reverseArray': '$imageList' },
                            'as': 'item',
                            'in': {
                                'idImage': '$$item._id',
                                'postId': '$_id',
                                'pathFile': '$$item.pathFile',
                                'contentPost': '$contentPost',
                                'imageEmotion': '$$item.imageEmotion',
                                'totalCommentImage': {
                                    '$size': {
                                        '$ifNull': [{
                                                '$filter': {
                                                    'input': '$commentList',
                                                    'as': 'commentItem',
                                                    'cond': {
                                                        '$eq': [
                                                            { '$cond': [{ '$ne': ['$$commentItem.IdImage', 'undefined'] }, { '$toObjectId': '$$commentItem.IdImage' }, '$$commentItem.IdImage'] },
                                                            '$$item._id'
                                                        ]
                                                    }
                                                }
                                            },
                                            []
                                        ]
                                    }
                                }
                            }
                        }
                    },
                    'videoList': {
                        '$map': {
                            'input': { '$reverseArray': '$videoList' },
                            'as': 'item',
                            'in': {
                                'idVideo': '$$item._id',
                                'postId': '$_id',
                                'pathFile': '$$item.pathFile',
                                'thumbnailName': '$$item.thumbnailName',
                                'contentPost': '$contentPost',
                                'videoEmotion': '$$item.videoEmotion',
                                'totalCommentVideo': {
                                    '$size': {
                                        '$ifNull': [{
                                                '$filter': {
                                                    'input': '$commentList',
                                                    'as': 'commentItem',
                                                    'cond': {
                                                        '$eq': [
                                                            { '$cond': [{ '$ne': ['$$commentItem.IdVideo', 'undefined'] }, { '$toObjectId': '$$commentItem.IdVideo' }, '$$commentItem.IdVideo'] },
                                                            '$$item._id'
                                                        ]
                                                    }
                                                }
                                            },
                                            []
                                        ]
                                    }
                                }
                            }
                        }
                    }
                }
            }, {
                '$group': {
                    '_id': '$createAt',
                    'imageList': {
                        '$push': '$imageList'
                    },
                    'videoList': {
                        '$push': '$videoList'
                    }
                }
            }, {
                '$addFields': {
                    'createAt': '$_id',
                    'imageInfo': {
                        '$reduce': {
                            'input': '$imageList',
                            'initialValue': [],
                            'in': {
                                '$concatArrays': [
                                    '$$value', '$$this'
                                ]
                            }
                        }
                    },
                    'videoInfo': {
                        '$reduce': {
                            'input': '$videoList',
                            'initialValue': [],
                            'in': {
                                '$concatArrays': [
                                    '$$value', '$$this'
                                ]
                            }
                        }
                    }
                }
            }, {
                '$unset': 'imageList'
            }, {
                '$unset': 'videoList'
            }, {
                '$sort': {
                    '_id': -1
                }
            }])

            for (let i = 0; i < post.length; i++) {
                if (post[i].imageInfo.length > 0 && req.body.type == 'image') {
                    for (let j = 0; j < post[i].imageInfo.length; j++) {
                        if (post[i].imageInfo[j].imageEmotion) {
                            post[i].imageInfo[j]['totalEmotionImage'] = post[i].imageInfo[j].imageEmotion.split(",").length - 1;
                        } else {
                            post[i].imageInfo[j]['totalEmotionImage'] = 0;
                        }
                        post[i].imageInfo[j].pathFile = `${urlImgHost()}Testnode/public/personalUpload/personalImage/${post[i].imageInfo[j].pathFile}`;
                        let arr = post[i].imageInfo[j].imageEmotion.split(',')
                        arr.shift()
                        arr.map(item => Number(item))
                        let listUser = []
                        if (arr.length > 0) {
                            listUser = await User.find({ _id: { $in: arr } }, { _id: 1, userName: 1, avatarUser: 1 })
                            listUser = listUser.map(user => {
                                if (user.avatarUser !== "") {
                                    user.avatarUser = `${urlImgHost()}avatarUser/${user._id}/${user.avatarUser}`
                                } else {
                                    user.avatarUser = `${urlImgHost()}avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                                }
                                return user
                            })
                        }
                        post[i].imageInfo[j]['emotion'] = listUser
                    }
                    image.push({
                        createAt: post[i].createAt,
                        imageInfo: post[i].imageInfo
                    })
                }
                if (post[i].videoInfo.length > 0 && req.body.type == 'video') {

                    for (let j = 0; j < post[i].videoInfo.length; j++) {
                        console.log(post[i].videoInfo[j].videoEmotion)
                        if (post[i].videoInfo[j].videoEmotion) {

                            post[i].videoInfo[j]['totalEmotionVideo'] = post[i].videoInfo[j].videoEmotion.split(",").length - 1;
                        } else {
                            post[i].videoInfo[j]['totalEmotionVideo'] = 0;
                        }
                        post[i].videoInfo[j].pathFile = `${urlImgHost()}Testnode/public/personalUpload/personalVideo/${post[i].videoInfo[j].pathFile}`;
                        post[i].videoInfo[j].thumbnailName = `${urlImgHost()}Testnode/public/personalUpload/personalVideo/${post[i].videoInfo[j].thumbnailName}`;

                        if (post[i].videoInfo[j].videoEmotion) {
                            let arr = post[i].videoInfo[j].videoEmotion.split(',')
                            arr.shift()
                            arr.map(item => Number(item))
                            let listUser = []
                            if (arr.length > 0) {
                                listUser = await User.find({ _id: { $in: arr } }, { _id: 1, userName: 1, avatarUser: 1 })
                                listUser = listUser.map(user => {
                                    if (user.avatarUser !== "") {
                                        user.avatarUser = `${urlImgHost()}avatarUser/${user._id}/${user.avatarUser}`
                                    } else {
                                        user.avatarUser = `${urlImgHost()}avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                                    }
                                    return user
                                })
                            }
                            post[i].videoInfo[j]['emotion'] = listUser
                        } else post[i].videoInfo[j]['emotion'] = []
                    }
                    video.push({
                        createAt: post[i].createAt,
                        imageInfo: post[i].videoInfo
                    })
                }
            }
            if (post) {
                res.status(200).json({
                    data: {
                        message: "Success",
                        image,
                        video
                    },
                    error: null,
                })
            } else {
                res.status(200).json(createError(200, "Đã có lỗi"));
            }
        } else {
            res.status(200).json(createError(200, "Thiếu thông tin truyền lên"));
        }
    } catch (err) {
        console.error(err)
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
}

// api upload File trang cá nhân
export const UploadFilePersonal = async(req, res, next) => {
    try {
        if (req.files.length > 0) {
            let files = [];
            // console.log(req.files)
            for (let i = 0; i < req.files.length; i++) {
                const name = req.files[i].filename.slice(req.files[i].filename.indexOf('.'), req.files[i].filename.length)
                if (FileDanger.includes(name.toUpperCase())) {
                    return res.status(200).json(createError(200, "File được chọn không thể upload"))
                }
                // files.push(req.files[i].filename);
                // console.log(req.files[i])
                files.push(`${req.files[i].filename.split('-')[0]}-${req.files[i].originalname}`);
                // console.log(`${req.files[i].filename.split('-')[0]}-${req.files[i].originalname}`)
            };
            // console.log(files);
            for (let i = 0; i < files.length; i++) {
                if (req.files[i].filename.toUpperCase().split(".")[req.files[i].filename.toUpperCase().split(".").length - 1].includes('JPEG')) {
                    await sharp(`C:/Chat365/publish/wwwroot/TestNode/public/personalUpload/${files[i].replace(/[ +!@#$%^&*]/g, '')}`)
                        .resize({ fit: sharp.fit.contain, width: 1200, height: 1200 })
                        .toFile(`C:/Chat365/publish/wwwroot/TestNode/public/personalUploadSmall/${files[i]}`)
                } else if (req.files[i].filename.toUpperCase().split(".")[req.files[i].filename.toUpperCase().split(".").length - 1].includes('JPG')) {
                    await sharp(`C:/Chat365/publish/wwwroot/TestNode/public/personalUpload/${files[i].replace(/[ +!@#$%^&*]/g, '')}`)
                        .resize({ fit: sharp.fit.contain, width: 1200, height: 1200 })
                        .toFile(`C:/Chat365/publish/wwwroot/TestNode/public/personalUploadSmall/${files[i]}`)
                } else if (req.files[i].filename.toUpperCase().split(".")[req.files[i].filename.toUpperCase().split(".").length - 1].includes('PNG')) {
                    await sharp(`C:/Chat365/publish/wwwroot/TestNode/public/personalUpload/${files[i].replace(/[ +!@#$%^&*]/g, '')}`)
                        .resize({ fit: sharp.fit.contain, width: 1200, height: 1200 })
                        .toFile(`C:/Chat365/publish/wwwroot/TestNode/public/personalUploadSmall/${files[i]}`)
                }
            }
            // console.log("Du lieu file tra ve",files)
            res.json({
                data: {
                    result: true,
                    message: 'Upload File thành công',
                    listNameFile: files
                },
                error: null
            })
        } else {
            res.status(200).json(createError(200, "Vui lòng chọn file muốn Upload"))
        }
    } catch (err) {
        console.log(err)
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"))
    }
}

export const GetComments = async(req, res, next) => {
    try {
        if (req.body.token) {
            let check = await checkToken(req.body.token);
            if (check && check.status) {
                console.log("Token hop le,GetComments ")
            } else {
                return res.status(404).json(createError(404, "Invalid token"));
            }
        }
        if (req.body.id && req.body.listComment && req.body.countComment) {
            const id = req.body.id
            const countComment = Number(req.body.countComment)
            const listComment = Number(req.body.listComment)
            let query = [{}]
            if (req.body.type == 1) {
                query = [
                    { 'IdImage': { '$exists': false } },
                    { 'IdVideo': { '$exists': false } },
                ]
            } else if (req.body.type == 3) {
                query = [
                    { 'IdImage': req.body.idImage },
                    { 'IdVideo': { '$exists': false } },
                ]
            } else if (req.body.type == 4) {
                query = [
                    { 'IdImage': { '$exists': false } },
                    { 'IdVideo': req.body.idVideo },
                ]
            }

            const commentList = await Personal.aggregate([{
                '$match': {
                    '_id': ObjectId(id)
                }
            }, {
                '$project': {
                    'commentList': 1
                }
            }, {
                '$unwind': {
                    'path': '$commentList'
                }
            }, {
                '$project': {
                    'comment': '$commentList'
                }
            }, {
                '$project': {
                    '_id': '$comment._id',
                    'commentatorId': '$comment.commentatorId',
                    'commentName': '$comment.commentName',
                    'commentAvatar': '$comment.commentAvatar',
                    'content': '$comment.content',
                    'commentEmotion': '$comment.commentEmotion',
                    'createAt': '$comment.createAt',
                    'image': '$comment.image',
                    'IdVideo': '$comment.IdVideo',
                    'IdImage': '$comment.IdImage'
                }
            }, {
                '$match': {
                    '$and': query
                }
            }, {
                '$sort': {
                    'createAt': -1
                }
            }, {
                '$skip': listComment
            }, {
                '$limit': countComment
            }])
            if (commentList.length > 0) {
                for (var i = 0; i < commentList.length; i++) {
                    if (commentList[i].image) {
                        commentList[i].image = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${commentList[i].image}`
                    }
                    commentList[i].totalCommentEmotion = commentList[i].commentEmotion.split(',').length - 1
                    commentList[i].commentEmotion = commentList[i].commentEmotion.slice(1)
                }
                res.json({
                    data: {
                        result: true,
                        message: 'Lấy danh sách bình luận thành công',
                        countComment: commentList.length,
                        commentList: commentList
                    },
                    error: null
                })
            } else {
                res.status(200).json(createError(200, "Không có bình luận nào"));
            }
        } else {
            res.status(200).json(createError(200, "Thiếu thông tin truyền lên"));
        }
    } catch (err) {
        console.error(err)
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
}

export const GetAllIdPost = async(req, res) => {
    try {
        const userId = Number(req.params.userId)
        const personal = await Personal.find({ userId: userId }, { _id: 1, imageListId: 1, videoListId: 1, createAt: 1 }).sort({ createdAt: 1 })
        for (let i = 0; i < personal.length; i++) {
            let arr = []
            for (let j = 0; j < personal[i].imageListId.length; j++) {
                arr = [...arr, ...personal[i].imageListId[j]]
            }
            personal[i].imageListId = arr
            arr = []
            for (let j = 0; j < personal[i].videoListId.length; j++) {
                arr = [...arr, ...personal[i].videoListId[j]]
            }
            personal[i].videoListId = arr
        }
        return res.status(200).json({
            data: {
                result: 'Success',
                message: "Lấy thông tin thành công",
                personal
            },
            error: null,
        })
    } catch (err) {
        console.log(err);
        return res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
}

export const GetPostsFriend = async(req, res) => {
    try {
        const userId = Number(req.body.userId)
        const userIds = [userId]
        let page = req.body.page
        const time = new Date()
        time.setMonth(time.getMonth() - 3)
        const data = []
        const listConv = await Conversation.find({
            'memberList.memberId': userId,
            isGroup: 0,
            'messageList.0': { $exists: true }
        }, {
            'memberList.memberId': 1,
            timeLastMessage: 1
        }).sort({ timeLastMessage: -1 }).limit(100).lean()
        listConv.map(conv => {
            if (conv.memberList[0].memberId == userId) {
                userIds.push(conv.memberList[1].memberId)
            } else {
                userIds.push(conv.memberList[0].memberId)
            }
        })
        const contact = await Contact.find({ $or: [{ userFist: userId }, { userSecond: userId }] }).limit(100).lean()
        contact.map(item => {
            if (item.userFist != userId && !userIds.includes(item.userFist)) {
                userIds.push(item.userFist)
            }
            if (item.userSecond != userId && !userIds.includes(item.userSecond)) {
                userIds.push(item.userSecond)
            }
        })
        if (req.body.companyId) {
            const listUserCompany = await User.find({ _id: { $nin: userIds }, companyId: Number(req.body.companyId) }, { _id: 1 }).sort({ isOnline: -1, lastActive: -1 }).limit(100).lean()
            listUserCompany.map(user => {
                userIds.push(user._id)
            })
        }
        const privacy = await Privacy.find({ userId: { $in: userIds } }, { post: 1,  hidePost: 1, blockPost: 1, userId: 1}).lean()
        let index = privacy.findIndex(item => item.userId == userId)
        if (index != -1) {
            privacy[index].hidePost.map(userId => {
                userIds.splice(userIds.indexOf(userId), 1);
            })
        }
        const listPost = await Personal.find({ userId: { $in: userIds }, raw: { $exists: true }, createAt: { $gt: time }, type: { $ne: 1 } }).sort({createAt: 'desc'})
        for (let i = 0; i < listPost.length; i++) {
            index = privacy.findIndex(item => item.userId == listPost[i].userId)
            if (index != -1) {
                if (privacy[index].blockPost.includes(userId)) {
                    continue
                }
                let timePost = new Date()
                if (privacy[index].post == 2) {
                    timePost.setMonth(timePost.getMonth() - 1)
                } else if (privacy[index].post == 3) {
                    timePost.setDate(timePost.getDate() - 7)
                } else if (privacy[index].post != 0 && privacy[index].post != 1) {
                    timePost = new Date(privacy[index].post)
                }
                if (listPost[i].createAt < timePost) {
                    continue
                }
            }
        }
    
        if (listPost) {
            if (listPost.length > 0) {
                for (let i = 0; i < listPost.length; i++) {
                    let totalCommnet = 0
                    let comment = []
                    for (let j = 0; j < listPost[i].commentList.length; j++) {
                        const user = await User.find({ _id: { $in: listPost[i].commentList[j].listTag } }, { userName: 1, _id: 1, avatarUser: 1 })
                        if (user.avatarUser !== '') {
                            user.avatarUser = `${urlImgHost()}/avatarUser/${user._id}/${user.avatarUser}`
                        } else {
                            user.avatarUser = `${urlImgHost()}/avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                        }
                        listPost[i]._doc.commentList[j].listTag = user

                        if (!listPost[i].commentList[j].IdImage && !listPost[i].commentList[j].IdVideo) {
                            totalCommnet += 1

                        } else if (listPost[i].commentList[j].IdImage) {

                            comment.push({
                                id: listPost[i].commentList[j].IdImage,
                            })

                        } else if (listPost[i].commentList[j].IdVideo) {

                            comment.push({
                                id: listPost[i].commentList[j].IdVideo,
                            })
                        }
                    }
                    listPost[i]._doc.totalCommnet = totalCommnet
                    for (let j = 0; j < listPost[i].imageList.length; j++) {

                        let count = comment.filter(item => item.id == listPost[i].imageList[j]._id).length;

                        if (count >= 0) {
                            listPost[i]._doc.imageList[j]._doc.totalComment = count
                        } else {
                            listPost[i]._doc.imageList[j]._doc.totalComment = 0
                        }

                    }
                    

                    for (let j = 0; j < listPost[i].videoList.length; j++) {

                        let count = comment.filter(item => item.id == listPost[i].videoList[j]._id).length;

                        if (count >= 0) {
                            listPost[i]._doc.videoList[j]._doc.totalComment = count
                        } else {
                            listPost[i]._doc.videoList[j]._doc.totalComment = 0
                        }

                    }

                    // console.log(listPost[i]._doc)
                    if (listPost[i].emotion) {
                        listPost[i]._doc.totalEmotion = listPost[i].emotion.split("/").length - 1;
                    } else {
                        listPost[i]._doc.totalEmotion = 0;
                    }
                    let arr = []
                    for (let j = 0; j < listPost[i].imageListId.length; j++) {
                        arr = [...arr, ...listPost[i].imageListId[j]]
                    }
                    listPost[i].imageListId = arr
                    arr = []
                    for (let j = 0; j < listPost[i].videoListId.length; j++) {
                        arr = [...arr, ...listPost[i].videoListId[j]]
                    }
                    listPost[i].videoListId = arr
                    for (let j = 0; j < listPost[i].imageList.length; j++) {
                        listPost[i].imageList[j].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${listPost[i].imageList[j].pathFile}`
                    }
                    for (let j = 0; j < listPost[i].videoList.length; j++) {
                        listPost[i].videoList[j].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${listPost[i].videoList[j].pathFile}`
                        listPost[i].videoList[j].thumbnailName = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${listPost[i].videoList[j].thumbnailName}`
                    }

                   
                }

                let countpost = Number(listPost.length)
                if (countpost < 0) {
                    countpost = 0
                }
                let start = Number(page)
                let end = Number(page) + 10
                
                if (start >= countpost) {
                    start = countpost - 1
                }
                if (Number(page) + 10 > countpost) {
                    end = countpost
                }

                let personalListPost = []
                for (let i = start; i < end; i++) {
                    personalListPost.push(listPost[i])
                }
                console.log(start,end)
                res.status(200).json({
                    data: {
                        totalPost: listPost.length,
                        result: personalListPost,
                        message: "Lấy thông tin thành công",
                    },
                    error: null
                })

            } else {
                res.status(200).json(createError(200, "Id không chính xác hoac khong co bai viet nao"))
            }
        }else res.status(200).json(createError(200, "Không có bài viết nào"));

    } catch (err) {
        console.log(err);
        return res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
}

export const deleteFileAlbum = async(req, res) => {
    try {
        if (req.body.idAlbum) {
            let IdImage = []
            let IdVideo = []
            if (req.body.listImageId) {
                if (!req.body.listImageId.includes("[")) {
                    IdImage = req.body.listImageId;
                } else {
                    let string = String(req.body.listImageId).replace("[", "");
                    string = String(string).replace("]", "");
                    let list = string.split(",");
                    for (let i = 0; i < list.length; i++) {
                        if (list[i]) {
                            IdImage.push(list[i]);
                        }
                    }
                }
            }


            if (req.body.listVideoId) {
                if (!req.body.listVideoId.includes("[")) {
                    IdVideo = req.body.listVideoId;
                } else {
                    let string = String(req.body.listVideoId).replace("[", "");
                    string = String(string).replace("]", "");
                    let list = string.split(",");
                    for (let i = 0; i < list.length; i++) {
                        if (list[i]) {
                            IdVideo.push(list[i]);
                        }
                    }
                }
            }

            const idAlbum = req.body.idAlbum
            let deleteFile = await Personal.findOneAndUpdate({ _id: idAlbum }, {
                $pull: {
                    imageList: { _id: IdImage },
                    videoList: { _id: IdVideo },
                    imageListId: { IdImage },
                    videoListId: { IdVideo },
                }
            })
            if (deleteFile) {
                return res.status(200).json({
                    data: {
                        result: 'Success',
                        message: "Xóa file trong album thành công",
                    },
                    error: null,
                })
            }

        }
        return res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));

    } catch (err) {
        console.log(err);
        return res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
}

//thay đổi mô tả bản thân 
export const changeDescription = async(req, res) => {
    try {
        if(req.body.userId ){
            let userId = Number(req.body.userId)
            let description = req.body.description
           
            let updateUser = await User.findOneAndUpdate({_id: userId},{description: description},{new: true})
            if(updateUser){
                return res.status(200).json({
                    data: {
                        result: 'Success',
                        message: "Lấy thông tin thành công",
                        infoUser: updateUser
                    },
                    error: null,
                })
            }else return res.status(200).json(createError(200, "không tìm thấy user"));
        }else return res.status(200).json(createError(200, "Thiếu thông tin truyền lên"));
        
        
    } catch (err) {
        console.log(err);
        return res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
}

//ảnh, video dc yêu thích nhiều nhất đưa lên đầu
export const GetListFavorLibra = async(req, res, next) => {
    try {
        if (req && req.body && req.body.userId && req.body.type) {
            let image = []
            let video = []
            let post =[]
            if(req.body.type =='image'){
               
                post = await Personal.aggregate([{
                    '$match': {
                        'userId': Number(req.body.userId),
                        'contentPost': { $exists: true }
                    }
                }, {
                    $sort: {
                        createAt: -1,
                    },
                }, {
                    '$project': {
                        '_id': 1,
                        'imageList': 1,
                        'createAt': 1,
                        'contentPost': 1,
                        'commentList': 1
                    }
                }, {
                    '$addFields': {
                        'createAt': {
                            '$dateToString': {
                                'date': '$createAt',
                                'timezone': '+07:00',
                                'format': '%G-%m-%d'
                            }
                        }
                    }
                }, {
                    '$addFields': {
                        'imageList': {
                            '$map': {
                                'input': { '$reverseArray': '$imageList' },
                                'as': 'item',
                                'in': {
                                    'idImage': '$$item._id',
                                    'postId': '$_id',
                                    'pathFile': '$$item.pathFile',
                                    'contentPost': '$contentPost',
                                    'imageEmotion': '$$item.imageEmotion',
                                    'totalEmotionImage': {
                                        '$subtract': [
                                          { '$size': { '$split': ["$$item.imageEmotion", ","] } },
                                          1,
                                        ],
                                      },
                                    'totalCommentImage': {
                                        '$size': {
                                            '$ifNull': [{
                                                    '$filter': {
                                                        'input': '$commentList',
                                                        'as': 'commentItem',
                                                        'cond': {
                                                            '$eq': [
                                                                { '$cond': [{ '$ne': ['$$commentItem.IdImage', 'undefined'] }, { '$toObjectId': '$$commentItem.IdImage' }, '$$commentItem.IdImage'] },
                                                                '$$item._id'
                                                            ]
                                                        }
                                                    }
                                                },
                                                []
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                    }
                }, {
                    '$group': {
                        '_id': '$createAt',
                        'imageList': {
                            '$push': '$imageList'
                        },
                    }
                }, {
                    '$addFields': {
                        'createAt': '$_id',
                        'imageInfo': {
                            '$reduce': {
                                'input': '$imageList',
                                'initialValue': [],
                                'in': {
                                    '$concatArrays': [
                                        '$$value', '$$this'
                                    ]
                                }
                            },
                        },
                    }
                },
                // Unwind imageInfo and videoInfo arrays
                { $unwind: { path: "$imageInfo", preserveNullAndEmptyArrays: true } },
              
                // Sort the imageInfo array by 'totalEmotionImage' in descending order
                {
                  $sort: { "imageInfo.totalEmotionImage": -1 },
                   
                },
    
                // Group back to restore the original structure
                { $unwind: { path: "$imageInfo", preserveNullAndEmptyArrays: true } },
                { $replaceRoot: { newRoot: "$imageInfo" } },
              
                {
                    '$unset': 'imageList'
                }, {
                    '$sort': {
                        '_id': -1
                    }
                },
                
            ])
            
            }

            if(req.body.type =='video'){
               
                post = await Personal.aggregate([{
                    '$match': {
                        'userId': Number(req.body.userId),
                        'contentPost': { $exists: true }
                    }
                }, {
                    $sort: {
                        createAt: -1,
                    },
                }, {
                    '$project': {
                        '_id': 1,
                        'videoList': 1,
                        'createAt': 1,
                        'contentPost': 1,
                        'commentList': 1
                    }
                }, {
                    '$addFields': {
                        'createAt': {
                            '$dateToString': {
                                'date': '$createAt',
                                'timezone': '+07:00',
                                'format': '%G-%m-%d'
                            }
                        }
                    }
                }, {
                    '$addFields': {
                        'videoList': {
                            '$map': {
                                'input': { '$reverseArray': '$videoList' },
                                'as': 'item',
                                'in': {
                                    'inVideo': '$$item._id',
                                    'postId': '$_id',
                                    'pathFile': '$$item.pathFile',
                                    'contentPost': '$contentPost',
                                    'videoEmotion': '$$item.videoEmotion',
                                    'totalEmotionVideo': {
                                        '$subtract': [
                                          { '$size': { '$split': ["$$item.videoEmotion", ","] } },
                                          1,
                                        ],
                                      },
                                    'totalCommentVideo': {
                                        '$size': {
                                            '$ifNull': [{
                                                    '$filter': {
                                                        'input': '$commentList',
                                                        'as': 'commentItem',
                                                        'cond': {
                                                            '$eq': [
                                                                { '$cond': [{ '$ne': ['$$commentItem.IdVideo', 'undefined'] }, { '$toObjectId': '$$commentItem.IdVideo' }, '$$commentItem.IdVideo'] },
                                                                '$$item._id'
                                                            ]
                                                        }
                                                    }
                                                },
                                                []
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                    }
                }, {
                    '$group': {
                        '_id': '$createAt',
                        'videoList': {
                            '$push': '$videoList'
                        },
                    }
                }, {
                    '$addFields': {
                        'createAt': '$_id',
                        'videoInfo': {
                            '$reduce': {
                                'input': '$videoList',
                                'initialValue': [],
                                'in': {
                                    '$concatArrays': [
                                        '$$value', '$$this'
                                    ]
                                }
                            },
                        },
                    }
                },
                // Unwind imageInfo and videoInfo arrays
                { $unwind: { path: "$videoInfo", preserveNullAndEmptyArrays: true } },
              
                // Sort the imageInfo array by 'totalEmotionImage' in descending order
                {
                  $sort: { "videoInfo.totalEmotionVideo": -1 },
                   
                },
    
                // Group back to restore the original structure
                { $unwind: { path: "$videoInfo", preserveNullAndEmptyArrays: true } },
                { $replaceRoot: { newRoot: "$videoInfo" } },
              
                {
                    '$unset': 'videoList'
                }, {
                    '$sort': {
                        '_id': -1
                    }
                },
                
            ])
            
            }
            
            for (let i = 0; i < post.length; i++) {
                if ( req.body.type == 'image' && post.length > 0 ) {

                            post[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${post[i].pathFile}`;
                            let arr = post[i].imageEmotion.split(',')
                            arr.shift()
                            arr.map(item => Number(item))
                            let listUser = []
                            if (arr.length > 0) {
                                listUser = await User.find({ _id: { $in: arr } }, { _id: 1, userName: 1, avatarUser: 1 })
                                listUser = listUser.map(user => {
                                    if (user.avatarUser !== "") {
                                        user.avatarUser = `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`
                                    } else {
                                        user.avatarUser = `${urlImgHostwf()}avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                                    }
                                    return user
                                })
                            }
                            post[i]['emotion'] = listUser 
                    
                    
                    image.push(post[i])
                }
                if (  req.body.type == 'video' && post.length > 0) {

                        post[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${post[i].pathFile}`;
                        post[i].thumbnailName = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${post[i].thumbnailName}`;

                        if (post[i].videoEmotion) {
                            let arr = post[i].videoEmotion.split(',')
                            arr.shift()
                            arr.map(item => Number(item))
                            let listUser = []
                            if (arr.length > 0) {
                                listUser = await User.find({ _id: { $in: arr } }, { _id: 1, userName: 1, avatarUser: 1 })
                                listUser = listUser.map(user => {
                                    if (user.avatarUser !== "") {
                                        user.avatarUser = `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`
                                    } else {
                                        user.avatarUser = `${urlImgHostwf()}avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                                    }
                                    return user
                                })
                            }
                            post[i]['emotion'] = listUser
                        } else post[i]['emotion'] = []
                    
                    video.push( post[i]
                    )
                }
            }
           
            if (post) {
                res.status(200).json({
                    data: {
                        message: "Success",
                        image,
                        video
                    },
                    error: null,
                })
            } else {
                res.status(200).json(createError(200, "Đã có lỗi"));
            }
        } else {
            res.status(200).json(createError(200, "Thiếu thông tin truyền lên"));
        }
    } catch (err) {
        console.error(err)
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
}

//ảnh, video dc bình luận nhiều nhất đưa lên đầu
export const GetListCommentLibra = async(req, res, next) => {
    try {
        if (req && req.body && req.body.userId && req.body.type) {
            let image = []
            let video = []
            let post =[]
            if(req.body.type =='image'){
               
                post = await Personal.aggregate([{
                    '$match': {
                        'userId': Number(req.body.userId),
                        'contentPost': { $exists: true }
                    }
                }, {
                    $sort: {
                        createAt: -1,
                    },
                }, {
                    '$project': {
                        '_id': 1,
                        'imageList': 1,
                        'createAt': 1,
                        'contentPost': 1,
                        'commentList': 1
                    }
                }, {
                    '$addFields': {
                        'createAt': {
                            '$dateToString': {
                                'date': '$createAt',
                                'timezone': '+07:00',
                                'format': '%G-%m-%d'
                            }
                        }
                    }
                }, {
                    '$addFields': {
                        'imageList': {
                            '$map': {
                                'input': { '$reverseArray': '$imageList' },
                                'as': 'item',
                                'in': {
                                    'idImage': '$$item._id',
                                    'postId': '$_id',
                                    'pathFile': '$$item.pathFile',
                                    'contentPost': '$contentPost',
                                    'imageEmotion': '$$item.imageEmotion',
                                    'totalEmotionImage': {
                                        '$subtract': [
                                          { '$size': { '$split': ["$$item.imageEmotion", ","] } },
                                          1,
                                        ],
                                      },
                                    'totalCommentImage': {
                                        '$size': {
                                            '$ifNull': [{
                                                    '$filter': {
                                                        'input': '$commentList',
                                                        'as': 'commentItem',
                                                        'cond': {
                                                            '$eq': [
                                                                { '$cond': [{ '$ne': ['$$commentItem.IdImage', 'undefined'] }, { '$toObjectId': '$$commentItem.IdImage' }, '$$commentItem.IdImage'] },
                                                                '$$item._id'
                                                            ]
                                                        }
                                                    }
                                                },
                                                []
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                    }
                }, {
                    '$group': {
                        '_id': '$createAt',
                        'imageList': {
                            '$push': '$imageList'
                        },
                    }
                }, {
                    '$addFields': {
                        'createAt': '$_id',
                        'imageInfo': {
                            '$reduce': {
                                'input': '$imageList',
                                'initialValue': [],
                                'in': {
                                    '$concatArrays': [
                                        '$$value', '$$this'
                                    ]
                                }
                            },
                        },
                    }
                },
                // Unwind imageInfo and videoInfo arrays
                { $unwind: { path: "$imageInfo", preserveNullAndEmptyArrays: true } },
              
                // Sort the imageInfo array by 'totalEmotionImage' in descending order
                {
                  $sort: { "imageInfo.totalCommentImage": -1 },
                   
                },
    
                // Group back to restore the original structure
                { $unwind: { path: "$imageInfo", preserveNullAndEmptyArrays: true } },
                { $replaceRoot: { newRoot: "$imageInfo" } },
              
                {
                    '$unset': 'imageList'
                }, {
                    '$sort': {
                        '_id': -1
                    }
                },
                
            ])
         
            }

            if(req.body.type =='video'){
               
                post = await Personal.aggregate([{
                    '$match': {
                        'userId': Number(req.body.userId),
                        'contentPost': { $exists: true }
                    }
                }, {
                    $sort: {
                        createAt: -1,
                    },
                }, {
                    '$project': {
                        '_id': 1,
                        'videoList': 1,
                        'createAt': 1,
                        'contentPost': 1,
                        'commentList': 1
                    }
                }, {
                    '$addFields': {
                        'createAt': {
                            '$dateToString': {
                                'date': '$createAt',
                                'timezone': '+07:00',
                                'format': '%G-%m-%d'
                            }
                        }
                    }
                }, {
                    '$addFields': {
                        'videoList': {
                            '$map': {
                                'input': { '$reverseArray': '$videoList' },
                                'as': 'item',
                                'in': {
                                    'inVideo': '$$item._id',
                                    'postId': '$_id',
                                    'pathFile': '$$item.pathFile',
                                    'contentPost': '$contentPost',
                                    'videoEmotion': '$$item.videoEmotion',
                                    'totalEmotionVideo': {
                                        '$subtract': [
                                          { '$size': { '$split': ["$$item.videoEmotion", ","] } },
                                          1,
                                        ],
                                      },
                                    'totalCommentVideo': {
                                        '$size': {
                                            '$ifNull': [{
                                                    '$filter': {
                                                        'input': '$commentList',
                                                        'as': 'commentItem',
                                                        'cond': {
                                                            '$eq': [
                                                                { '$cond': [{ '$ne': ['$$commentItem.IdVideo', 'undefined'] }, { '$toObjectId': '$$commentItem.IdVideo' }, '$$commentItem.IdVideo'] },
                                                                '$$item._id'
                                                            ]
                                                        }
                                                    }
                                                },
                                                []
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                    }
                }, {
                    '$group': {
                        '_id': '$createAt',
                        'videoList': {
                            '$push': '$videoList'
                        },
                    }
                }, {
                    '$addFields': {
                        'createAt': '$_id',
                        'videoInfo': {
                            '$reduce': {
                                'input': '$videoList',
                                'initialValue': [],
                                'in': {
                                    '$concatArrays': [
                                        '$$value', '$$this'
                                    ]
                                }
                            },
                        },
                    }
                },
                // Unwind imageInfo and videoInfo arrays
                { $unwind: { path: "$videoInfo", preserveNullAndEmptyArrays: true } },
              
                // Sort the imageInfo array by 'totalEmotionImage' in descending order
                {
                  $sort: { "videoInfo.totalCommentVideo": -1 },
                   
                },
    
                // Group back to restore the original structure
                { $unwind: { path: "$videoInfo", preserveNullAndEmptyArrays: true } },
                { $replaceRoot: { newRoot: "$videoInfo" } },
              
                {
                    '$unset': 'videoList'
                }, {
                    '$sort': {
                        '_id': -1
                    }
                },
                
            ])
            
            }
            
            for (let i = 0; i < post.length; i++) {
                if ( req.body.type == 'image' && post.length > 0 ) {
                    console.log(post[i])
                            post[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${post[i].pathFile}`;
                            let arr = post[i].imageEmotion.split(',')
                            arr.shift()
                            arr.map(item => Number(item))
                            let listUser = []
                            if (arr.length > 0) {
                                listUser = await User.find({ _id: { $in: arr } }, { _id: 1, userName: 1, avatarUser: 1 })
                                listUser = listUser.map(user => {
                                    if (user.avatarUser !== "") {
                                        user.avatarUser = `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`
                                    } else {
                                        user.avatarUser = `${urlImgHostwf()}avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                                    }
                                    return user
                                })
                            }
                            post[i]['emotion'] = listUser 
                    image.push(
                        post[i]
                    )
                }
                if (  req.body.type == 'video' && post.length > 0) {

                        post[i].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${post[i].pathFile}`;
                        post[i].thumbnailName = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${post[i].thumbnailName}`;

                        if (post[i].videoEmotion) {
                            let arr = post[i].videoEmotion.split(',')
                            arr.shift()
                            arr.map(item => Number(item))
                            let listUser = []
                            if (arr.length > 0) {
                                listUser = await User.find({ _id: { $in: arr } }, { _id: 1, userName: 1, avatarUser: 1 })
                                listUser = listUser.map(user => {
                                    if (user.avatarUser !== "") {
                                        user.avatarUser = `${urlImgHostwf()}avatarUser/${user._id}/${user.avatarUser}`
                                    } else {
                                        user.avatarUser = `${urlImgHostwf()}avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                                    }
                                    return user
                                })
                            }
                            post[i]['emotion'] = listUser
                        } else post[i]['emotion'] = []
                    
                    video.push(
                       post[i]
                    )
                }
            }
           
            if (post) {
                res.status(200).json({
                    data: {
                        message: "Success",
                        image,
                        video
                    },
                    error: null,
                })
            } else {
                res.status(200).json(createError(200, "Đã có lỗi"));
            }
        } else {
            res.status(200).json(createError(200, "Thiếu thông tin truyền lên"));
        }
    } catch (err) {
        console.error(err)
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
}

export const getAllPostHistoryOneYear = async(req, res, next) => {
    try {
        if (req.params.token) {
            let check = await checkToken(req.params.token);
            if (check && check.status && (check.userId == req.params.userId)) {
                console.log("Token hop le, getAllPost")
            } else {
                return res.status(404).json(createError(404, "Invalid token"));
            }
        }
        if (req && req.params && req.params.userId && req.params.IdSeen && Number(req.params.userId) && Number(req.params.IdSeen)) {
            const userId = req.params.userId;
            const listpost = Number(req.params.listpost)
        
            let personal =[]
            let personalPost
            let checkPrivacy
            await ShowPersonal(Number(req.params.userId), Number(req.params.IdSeen)).then(e => checkPrivacy = e)
            console.log('checkPrivacy', checkPrivacy)
            if (checkPrivacy === true) {
                personalPost = await Personal.find({ userId: userId, type: { $ne: 1 }, raw: { $exists: true } }).sort({ createAt: 'desc' });
            } else if (checkPrivacy === false) {
                return res.status(200).json(createError(200, "Id không chính xác hoac khong co bai viet nao"))
            } else {
                personalPost = await Personal.find({ userId: userId, createAt: { $gt: checkPrivacy }, type: { $ne: 1 }, raw: { $exists: true } }).sort({ createAt: 'desc' });
            }

            let dateMonth = new Date().getMonth()
            let dateDay = new Date().getDate()
            let dateYear = new Date().getUTCFullYear() -1
            
            for (let i=0 ; i< personalPost.length ; i++) {
                console.log(i)
                if(personalPost[i].createAt.getDate() == dateDay && personalPost[i].createAt.getMonth() == dateMonth && personalPost[i].createAt.getUTCFullYear() == dateYear){
                    personal.push(personalPost[i])
                }
            }
            if(personal = []){
                return res.status(200).json(createError(200, " khong co bai viet nao 1 nam truoc"))
            }
            // check friend 0
            let check = false;
            let listFriendId = [];
            let checkFriend = await Contact.find({
                $or: [
                    { userFist: userId },
                    { userSecond: userId }
                ]
            });
            if (checkFriend) {
                for (let i = 0; i < checkFriend.length; i++) {
                    listFriendId.push(checkFriend[i].userFist);
                    listFriendId.push(checkFriend[i].userSecond);
                };
                listFriendId = listFriendId.filter(e => Number(e) != Number(userId))
            }

            if (listFriendId.includes(Number(req.params.IdSeen))) {
                check = true;
            }

            if (personal) {
                if (personal.length > 0) {

                    for (let i = 0; i < personal.length; i++) {
                        let totalCommnet = 0
                        let comment = []
                        for (let j = 0; j < personal[i].commentList.length; j++) {
                            const user = await User.find({ _id: { $in: personal[i].commentList[j].listTag } }, { userName: 1, _id: 1, avatarUser: 1 })
                            if (user.avatarUser !== '') {
                                user.avatarUser = `${urlImgHost()}/avatarUser/${user._id}/${user.avatarUser}`
                            } else {
                                user.avatarUser = `${urlImgHost()}/avatar/${user.userName[0]}_${Math.floor(Math.random() * 4) + 1}.png`
                            }
                            personal[i]._doc.commentList[j].listTag = user

                            if (!personal[i].commentList[j].IdImage && !personal[i].commentList[j].IdVideo) {
                                totalCommnet += 1

                            } else if (personal[i].commentList[j].IdImage) {

                                comment.push({
                                    id: personal[i].commentList[j].IdImage,
                                })

                            } else if (personal[i].commentList[j].IdVideo) {

                                comment.push({
                                    id: personal[i].commentList[j].IdVideo,
                                })
                            }
                        }

                        for (let j = 0; j < personal[i].imageList.length; j++) {

                            let count = comment.filter(item => item.id == personal[i].imageList[j]._id).length;

                            if (count >= 0) {
                                personal[i]._doc.imageList[j]._doc.totalComment = count
                            } else {
                                personal[i]._doc.imageList[j]._doc.totalComment = 0
                            }

                        }
                        personal[i]._doc.totalCommnet = totalCommnet

                        for (let j = 0; j < personal[i].videoList.length; j++) {

                            let count = comment.filter(item => item.id == personal[i].videoList[j]._id).length;

                            if (count >= 0) {
                                personal[i]._doc.videoList[j]._doc.totalComment = count
                            } else {
                                personal[i]._doc.videoList[j]._doc.totalComment = 0
                            }

                        }

                        // console.log(personal[i]._doc)
                        if (personal[i].emotion) {
                            personal[i]._doc.totalEmotion = personal[i].emotion.split("/").length - 1;
                        } else {
                            personal[i]._doc.totalEmotion = 0;
                        }
                        let arr = []
                        for (let j = 0; j < personal[i].imageListId.length; j++) {
                            arr = [...arr, ...personal[i].imageListId[j]]
                        }
                        personal[i].imageListId = arr
                        arr = []
                        for (let j = 0; j < personal[i].videoListId.length; j++) {
                            arr = [...arr, ...personal[i].videoListId[j]]
                        }
                        personal[i].videoListId = arr
                        for (let j = 0; j < personal[i].imageList.length; j++) {
                            personal[i].imageList[j].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalImage/${personal[i].imageList[j].pathFile}`
                        }
                        for (let j = 0; j < personal[i].videoList.length; j++) {
                            personal[i].videoList[j].pathFile = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${personal[i].videoList[j].pathFile}`
                            personal[i].videoList[j].thumbnailName = `${urlImgHostwf()}Testnode/public/personalUpload/personalVideo/${personal[i].videoList[j].thumbnailName}`
                        }

                    }

                    for (let i = personal.length - 1; i >= 0; i--) {
                        if (String(personal[i].raw) === "2") {
                          if (Number(req.params.IdSeen) !== Number(req.params.userId)) {
                            personal = personal.filter(e => e._id != personal[i]._id);
                          }
                        } else if (Number(personal[i].raw) === 1) {
                          if (!check) {
                            personal = personal.filter(e => e._id != personal[i]._id);
                          }
                        } else if (personal[i].raw.includes('3/')) {
                          const s = personal[i].raw.slice(2);
                          if (!s.split(",").includes(String(req.params.IdSeen)) && Number(req.params.IdSeen) !== personal[i].userId) {
                            personal = personal.filter(e => e._id != personal[i]._id);
                          }
                        } else if (personal[i].raw.includes('4/')) {
                          const s = personal[i].raw.slice(2);
                          if (s.split(",").includes(String(req.params.IdSeen))) {
                            personal = personal.filter(e => e._id != personal[i]._id);
                          }
                          if (!check) {
                            personal = personal.filter(e => e._id != personal[i]._id);
                          }
                        }
                      }
                      

                    let countpost = personal.length
                    if (countpost < 0) {
                        countpost = 0
                    }
                    let start = listpost
                    let end = listpost + 10

                    if (start >= countpost) {
                        start = countpost - 1
                    }
                    if (listpost + 10 > countpost) {
                        end = countpost
                    }

                    let personalListPost = []
                    for (let i = start; i < end; i++) {
                        personalListPost.push(personal[i])
                    }
                    res.status(200).json({
                        data: {
                            result: personalListPost,
                            message: "Lấy thông tin thành công",
                        },
                        error: null
                    })

                } else {
                    res.status(200).json(createError(200, "Id không chính xác hoac khong co bai viet nao"))
                }
            } else   res.status(200).json(createError(200, "Không có bài viết nào"));
        } else {
            res.status(200).json(createError(200, "Thông tin truyền lên không đầy đủ"));
        }

    } catch (err) {
        console.log(err);
        res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
}

// Thêm trường trong cuộc trò chuyện
export const InsertBase = async (req, res) => {
    try {

        // let ré = await Personal.updateMany(
        //   {},
        //   {
        //     userName: ""
        //   },
        // );
          res.status(200).json({
            message: "Thêm trường thành công"
          })
    } catch (err) {
      console.log("turnOffNoTifyConv,hùng", err);
      res.status(200).json(createError(200, "Đã có lỗi xảy ra"));
    }
  };
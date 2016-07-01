'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');
var express = require('express');
var SocketIo = require('socket.io');


/**
 * 存储用户和房间的关系的
 */
var roomMap = {
    'aa1': 'roomA',
    'aa2': 'roomA',
    'bb1': 'roomB',
    'bb2': 'roomB',
};
var getRoom = (userId) => {
    return roomMap[userId] || 'default-room';
};
//检查数据是否是房间id
var isRoom = (roomId) => {
    return ['roomA', 'roomB'].indexOf(roomId) >= 0;
}

var app = express();
var server = http.Server(app);
app.use(express.static(path.join(__dirname,'./public'))); //指定静态文件目录
// socket.io配置
var io = new SocketIo(server, {
    pingTimeout: 1000 * 15,  // 默认1分钟(1000*60)，设置15秒超时时间
    pingInterval: 1000 * 2,  // 默认(1000 * 2.5)，设置ping的频率
    transports: ['websocket','polling'],  // 传输一种方式
    allowUpgrades: true,    // 默认true，传输方式是否允许升级
    httpCompression: true,  // 默认true，传输数据使用加密
    path: '/socket.io',  //默认客户端路径(http://localhost:8000/socket.io/socket.io.js)，改变路径js/socket.io.js
    serveClient: false, //禁用访问客户端socket.io.js这个文件(http://localhost:8000/socket.io/socket.io.js)，使用本地下载好的
});

//用户认证
io.set('authorization', (handshakeData, accept) => {
    //验证用户是否有cookie
    if(handshakeData.headers.cookie){
        handshakeData.headers.userId = Date.now(); //在对象里给userId赋值一个时间
        accept(null, true); //认证通过
    }else{
        accept('Authorization Error', false); //认证失败,不允许通过
    }
});

//遍历map中所有连接用户
var getUserList = (userMap) => {
    var userList = [];
    for(let client of usersMap.values()){
        userList.push(client.nickName); 
    }
    return userList;
}
var usersMap = new Map();
/**
 * 监听连接成功
 */
io.on('connection', (socket) => {
    //console.log(socket.handshake.headers.userId);

    //io.emit('online', socket.id);//发送广播事件，通知所有客户端
    //io.sockets.emit('online', socket.id);//也是发送广播事件
    //socket.broadcast.emit('online', socket.id);//除自己之外，发给所有人广播事件
    
    //监听用户上线
    socket.on('server.online', (nickName) => {
        socket.nickName = nickName; //将用户输入昵称存储到socket对象中
        
        /**
         * 设置昵称的时候，加入房间
         */
        var roomId = getRoom(nickName);
        socket.join(roomId);
        console.log(`${nickName} 加入了房间 ${roomId}`);
        // socket.leave(roomId); //离开房间
        io.emit('client.online', nickName);
         //发送一个加入房间的通知
        socket.emit('client.joinroom',{nickName: nickName, roomId: roomId});
    });
    //监听客户端发送的消息事件
    socket.on('server.newMsg', (msgObj) => {
        console.log('11111111');
        //拦截下是不是消息加人房间的
        if(msgObj.type === 'text'){
            var splitPoint = msgObj.data.indexOf(':'); 
            if(splitPoint > 0){
                var roomId = msgObj.data.substring(0, splitPoint);
                if(isRoom(roomId)){
                    var msg = msgObj.data.substring(splitPoint + 1);
                    msgObj.data = msg;
                    io.to(roomId).emit('client.newMsg', msgObj);
                    return;    
                }
            }
        }

        //-----------------------------
        msgObj.now = Date.now();
        msgObj.nickName = socket.nickName;
        io.emit('client.newMsg', msgObj); //将用户发送聊天消息进行广播

    });




    //监听客户端发来的获取用户列表的事件
    socket.on('server.getOnlineList', () => {
        socket.emit('client.onlineList', getUserList(usersMap));
    });
    //监听客户端发送的文件数据
    socket.on('server.sendfile', (fileMsgObj) => {
        //找到文件当前路径
        var filePath = path.resolve(__dirname, `./public/files/${fileMsgObj.fileName}`);
        //同步以二进制方式写文件
        fs.writeFileSync(filePath, fileMsgObj.file, 'binary');
        //广播发送给所有客户端
        io.emit('client.file', {
            nickName: socket.nickName,
            now: Date.now(),
            data: fileMsgObj.fileName,
            clientId:fileMsgObj.clientId
        });
    });
    //监听用户下线
    socket.on('disconnect', () => {
        usersMap.delete(socket.id); //用户掉线了从map集合里移除
        socket.broadcast.emit('client.offline', socket.nickName);
    });

    //将每次连接成功的客户端用户存储到map中
    usersMap.set(socket.id, socket);
    //遍历map中所有连接的客户端
    for(let client of usersMap.values()){
        if(client.id !== socket.id){
            client.emit('online', 'welcome');
        }
    }

});

/**
 * 创建命名空间
 */
var newNsp = io.of('/nsp1');
newNsp.on('connection', (socket) => {
    console.log('newNsp client connected');
    //io.emit('test','message from nsp1'); //调用默认命名空间发送消息
});


  






//监听端口
server.listen('8000', (err) => {
    if(err){
        return console.log(err);
    }
    console.log('Server started, listening port %s', server.address().port);
});
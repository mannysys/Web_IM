$(function(){
    // 监听对浏览器窗口调整大小进行计数
    $(window).on('resize', function(){
        var clientHeight = document.documentElement.clientHeight; //获取浏览器窗口可视化高度
        $('.app-user-list-body').height(clientHeight - 210); //设置用div户布局跟随窗口高低自动改变
        $('.app-chat-body').height(clientHeight - 100);
    }).resize();


    // 定义变量
    var nickName;
    var $appChatContent = $('.app-chat-content');
    var $elTemplate = $('#el_template');
    var $elInputMsg = $('#el_input_msg');  //输入框值
    var $elBtnSend = $('#el_btn_send'); //发送消息按钮
    var $elUserList = $('#table_userlist'); //用户列表
    var $elBtnSendfile = $('#el_btn_sendfile'); //发送文件按钮
    var $elBtnFileSend = $('#el_btn_file_send'); // 发送文件按钮
    var $elBtnFileCancel = $('#el_btn_file_cancel'); //发送文件取消按钮
    var $elFileUploadElements = $('.app-file-container, .backup'); // 发送文件弹出框和遮罩层
    var client = io.connect('http://localhost:8000', {
        reconnectionAttempts: 3,  //客户端重连次数设置3次
        reconnection: false,  //是否自动重连
        reconnectionDelay: 1000, //重连延时，1秒
        reconnectionDelayMax: 5000, //延时最大值，多久
        timeout: 2000,  //超时时间
        autoConnect: true //是否自动连接
    });

    /**
     * 连接指定的命名空间
     */
    var clientForNewNsp = io.connect('http://localhost:8000/nsp1');
    clientForNewNsp.on('connect', function(){

        console.log('clientForNewNsp connect server success');

    });
        
     //工具方法
    function writeMsg(type, msg, title, isSelf){
        title = title || (type === 'system'?'系统消息':'User');
        //获取html元素，将元素变量替换填充动态数据
        var template = $elTemplate.html()
        .replace('${title}', title)
        .replace('${bgClass}', type === 'system'?'label-danger':'label-info')
        .replace(/\${pullRight}/g, isSelf ? 'pull-right' : '')
        .replace('${textRight}', isSelf ? 'text-right' : '')
        .replace('${info-icon}', type === 'system'?'glyphicon-info-sign':'glyphicon-user')
        .replace('${time}', '00:00:00')
        .replace('${msg}', msg);
        $appChatContent.append($(template));
    }

    /*
     * 封装事件消息，发送给服务端
     */
    function sendMsg(msg, type){
        var msgObj = {
            type: type || 'text',
            data: msg,
            clientId: client.id
        };
        client.emit('server.newMsg', msgObj);
    }
    /*
     *   获取用户输入框内容数据发送服务端
     */
    $elBtnSend.on('click', function(){
        var value = $elInputMsg.val();
        if(value){
            sendMsg(value);
            $elInputMsg.val('');
        }
    });

    /*
     * 监听处理用户发送文件事件
     */
    $elBtnSendfile.on('click', function(){
        //显示用户发送文件弹出框和遮罩层
        $elFileUploadElements.show();
    });
    //监听处理用户发送文件数据
    $elBtnFileSend.on('click', function(){
        var files = document.getElementById('el_file').files;
        if(files.length === 0){
            return window.alert('Must select a file');
        }
        var file = files[0];
        console.log(file);
        //发送文件
        client.emit('server.sendfile', {
            clientId: client.id,
            file: file,
            fileName: file.name
        });
        $elFileUploadElements.hide();
    });
    //监听发送文件取消按钮，隐藏上传文件弹出框和遮罩层
    $elBtnFileCancel.on('click', function(){
        $elFileUploadElements.hide();
    })
    /*
     *   paste监听图片粘贴事件
     */
    $(document).on('paste', function(e){
        var originalEvent = e.originalEvent; //拿到原始的事件
        var items;
        if(originalEvent.clipboardData && originalEvent.clipboardData.items){
            items = originalEvent.clipboardData.items;  //抓取剪贴板的数据
        } 
        if(items){
            for(var i=0, len = items.length; i < len; i++){
                var item = items[i];
                //判断文件类型
                if(item.kind === 'file'){
                    var pasteFile = item.getAsFile(); //拿到该文件
                    if(pasteFile.size > 1024 * 1024){
                        return;
                    }
                    var reader = new FileReader();//读取文件对象
                    //异步，加载该文件数据完成后，触发该事件
                    reader.onloadend = function(){
                        var imgBase64Str = reader.result; //拿到Base64数据
                        sendMsg(imgBase64Str, 'image'); //将图片base64数据发送服务端
                    }
                    //读取文件数据
                    reader.readAsDataURL(pasteFile);
                }
            }
        }
    });





    //用户输入昵称（输入昵称才停止循环）
    do{
        nickName = prompt('请输入您的昵称：');
    }while(!nickName);
    //显示用户昵称
    $('#span_nickname').text(nickName); 

    //发送给服务端用户上线通知事件和监听用户上线事件
    client.emit('server.online', nickName);

    //监听服务端发送来的聊天内容数据事件
    client.on('client.newMsg', function(msgObj){
        //将服务端发送来的Base64图片数据转换
        if(msgObj.type === 'image'){
            msgObj.data = '<img src="' + msgObj.data + '" alt="image">';
        }
        writeMsg('user', msgObj.data, msgObj.nickName, msgObj.clientId === client.id);
        //将聊天内容显示框滚动条的高度赋值给它的高度（滚动条始终在底部）
        $appChatContent[0].scrollTop = $appChatContent[0].scrollHeight;
     });

    client.on('client.online', function(nickName){
        writeMsg('system', '[' + nickName + '] 上线了');
    });
    //监听用户下线事件
    client.on('client.offline', function(nickName){
        writeMsg('system', '[' + nickName + '] 下线了');
    });

    //监听加入房间的消息
    client.on('client.joinroom', function(msgObj){
        writeMsg('user', '我加入了房间' + msgObj.roomId, msgObj.nickName);
    });
    //监听服务端发来在线用户列表数据，遍历所有用户
    client.on('client.onlineList', function(userList){
        $elUserList.find('tr').not(':eq(0)').remove();
        userList.forEach(function(userNick){
            var $tr = $('<tr><td>'+ userNick +'</td></tr>')
            $elUserList.append($tr);
        });
    });
    // 10秒触发一次事件，获取在线用户列表数据
    var intervalId = setInterval(function(){
        client.emit('server.getOnlineList'); //触发获取用户列表事件
        //如果client断开，那么就停止刷新在线用户列表
        // if(client){
        //     clearInterval(intervalId);
        // }
    }, 10 * 1000);

    //监听服务端发送的发送文件数据
    client.on('client.file', function(fileMsgObj){
        var content = '文件：<a href="/files/'+ fileMsgObj.data +'">'+ fileMsgObj.data +'</a>';
        writeMsg('user', content, fileMsgObj.nickName, client.id === fileMsgObj.clientId);
    });


    //-----------------------------------------------------------------------




    client.on('error', function (err) {
        console.log(err);
    });
    //连接
    client.on('connect', function () {
        console.log('连接成功！');
    });
    //断开连接
    client.on('disconnect', function (err) {
        console.log('断开连接' + err); //err是为什么断开
    });
    //重新连接
    client.on('reconnect', function (count) {
        console.log('重新连接的次数：' + count);
    });
    //尝试重连
    client.on('reconnect_attempt', function (count) {
        console.log('尝试重连的次数：' + count);
    });
    //重连中
    client.on('reconnecting', function () {
        console.log('重连中...');
    });
    //重连出错
    client.on('reconnect_error', function (err) {
        console.log('重连失败，' + err);
    });
    //重连直接失败
    client.on('reconnect_failed', function () {
        console.log('重连失败');
    });



});







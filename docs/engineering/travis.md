# Vue SSR 持续集成部署（CI/CD）：Travis + PM2 自动化部署 Node 应用

> 本文真的是手把手，只要你有耐心，一定可以完成整个流程

## 一、前言
在部署纯前端应用时，只要想办法把打包后的静态资源放到服务器就行，至于在本地还是线上服务器打包，那也只是选择的问题

而做服务端渲染时，涉及到Node服务器的部署，不仅仅是静态资源的构建与搬运，有小伙伴说可以每次更新完代码后上服务器手动重启Node服务器，但这可不符合程序员的懒学，而且手动操作得多就一定有误操作的风险

有道说懒是第一生产力，今天我们来个懒到极致的想法：只需要git push代码到远程分支，后续的构建、测试、自动部署、自动重启Node服务等工作全部自动化，变成一条自动生产线，其实就是常说的持续集成（Continuous Integration）与持续部署（Continuous Deployment）


## 二、基于Travis+PM2的 CI & CD 核心流程
本文将会沿着这个图展开，就算现在不理解也没事，等实践完再回来看就那么简单一回事
![](https://raw.githubusercontent.com/amandakelake/picgo-images/master/images/20200618152836.png)

首先本地要有一个基础服务端渲染的项目，我这里是用Vue + Koa 对着[Vue服务端渲染官方文档](https://ssr.vuejs.org/zh/)搭的，客户端和服务端的构建配置都可以直接跑，然后是推上Github，用github账号登录 [https://travis-ci.com](https://travis-ci.com/)，并激活仓库，Travis监听仓库文件改动，有更新时根据我们配置的`.travis.yml`执行相关的任务，可以把它理解为打包机，帮我们执行拉取最新代码、测试、构建等任务，把打包后的静态资源`dist`目录整个复制到部署服务器，同时直接触发部署服务器的PM2部署任务，自动重启Node服务

这里面比较核心的一个问题，是解决Github、Travis服务器、远程服务器之间的账号信任问题，本质上都是利用了SSH

总结起来，我们要解决的事情主要有这么几项
	* Linux 服务器
	* 基础 Node SSR 应用，包含基础构建
	* 使用Travis CI
	* 使用PM2管理Node应用
	* 基于SSH解决本机、Github、Travis服务器、远程服务器的信任通信
	* Travis + PM2 持续部署


## 三、Linux服务器初始化
从购买到初始化，俺手把手的准备好了 [买了☁️服务器后，第一步要干啥。。。？](https://github.com/amandakelake/blog/issues/102)

## 四、基础 Node SSR 应用

我准备好了 一个Vue服务器渲染的demo[vue-ssr](https://github.com/amandakelake/vue-ssr/tree/ssr)，克隆该项目的`ssr`分支即可，`master`分支我后面更新了很多配置，可以作为参考

至于vue服务端渲染的实现，可以看官方文档，或者这篇 ，这里就略过了，本文以CI/CD为核心
	- [ ] vue服务端渲染

执行下面命令项目就能跑了
```bash
git clone git@github.com:amandakelake/vue-ssr.git
# 切换到ssr分支
cd vue-ssr && git checkout ssr
# 安装依赖，构建客户端和服务端静态资源
yarn && yarn build
# 启动 Node 服务
yarn start
```

![](https://raw.githubusercontent.com/amandakelake/picgo-images/master/images/20200618160859.png)

然后直接访问`http://localhost:3000/bar`即可看到服务器渲染的界面了
![](https://raw.githubusercontent.com/amandakelake/picgo-images/master/images/20200618161158.png)

没问题后，在自己的github上创建一个仓库，关联推上去吧，后面要用了

## 五、使用Travis CI
### 5.1 Travis解决了什么问题？
当我们上传最新代码奥github后，我希望有一个工具能够自动拉取最新代码，然后按照我们的预设任务自动执行，然后自动发布到我们的个人服务器上，这个工具就是 Travis CI

> 哦对了，网上有些介绍travis的文章推荐的官网地址是  [travis-ci.org](https://travis-ci.org/)
> 但我们普通用户玩的应该是开源项目，访问 [travis-ci.com](https://travis-ci.com/)，这个坑，emm。。。我当时踩了大半天才发现，天煞的三桂啊

### 5.2 使用Travis要解决的核心问题
Travis需要权限来帮我们把静态资源复制到个人部署服务器上，或者登陆服务器进行操作，但travis不提供交互终端输入账号密码什么的，所以需要使用SSH免密登录服务器，这样才是自动化

### 5.3 SSH免密登录原理
SSH的免密登录原理也比较简单：在客户端（这里的客户端可以是任何机子）生成一对公私钥，将公钥存到服务器 `~/.ssh/authrized_keys`中，当客户端向服务器发起请求时，服务器会先发个字符串给客户端，客户端用本地私钥加密该字符串再发回给服务器，如果服务器能用公钥解密成功，那就登录成功了

### 5.4 Travis如何解决SSH的私钥安全性问题
本质上让travis装成一个客户端去连接我们的个人服务器，但是这个私钥保存在哪呢？
	* 保存在代码里，让travis从github去拉取？这跟公开密码有啥区别
所以travis提供了一个对私钥进行加密的功能，我们把加密后的私钥放在代码里，travis可以解密，然后再拿解密后的私钥去登录个人服务器

所以在这个地方，我们可以举一反三的解决上面一个问题：**基于SSH解决本机、Github、Travis服务器、远程服务器的信任通信**

在本机生成一份SSH公私钥，然后把公钥`is_rsa.pub`分别添加到到github与个人服务器的配置中，而travis其实和本机用的是同一份私钥`id_rsa`，所以通信信任问题解决了

### 5.5 激活Travis监听github仓库

用github账号登录  [travis-ci.com](https://travis-ci.com/) , 会看到你的所有仓库，然后点开开关（界面交互，一眼就会）

然后在项目中新建 `.travis.yml`文件，加入如下配置
```yaml
language: node_js
node_js:
	- stable
branchs:
	only:
		- master
cache:
	directories:
		- node_modules
before_install:
install:
	- yarn install
scripts:
	- yarn build
after_success:
```

搞完这两步，然后你推送一个代码更新上去看看，应该能在travis官网看到执行了`yarn install`和`yarn build`任务

就是这么简单，我们推送代码，travis自动执行任务

接下来我们要解决SSH免密登录的问题，先在本机安装travis来搞 `加密私钥`

### 5.6 本机安装Travis

> 网上的大部分相关文章首先是教你如何在线上服务器安装Travis，练手或者我们自己的博客项目，直接在本机mac撸起来即可（现在前端同学基本都用macbook做本地编程机，用window的同学需要先装个linux环境）

```bash
# 先安装rvm(rvm与ruby的关系，就跟nvm与node的关系一样)
curl -sSL https://get.rvm.io | bash -s stable
# 安装完需要启动rvm，具体路径在上面的输出结果中有
source /Users/lgc/.rvm/scripts/rvm
# 看一下rvm的版本，输出数字代表成功
rvm --version

# 用rvm安装ruby  这一步我自己等了15分钟~
rvm install ruby
# 安装完看下ruby版本  有数字代表成功
ruby --version

# 有了ruby，就可以用gem安装travis了
# 但gem的官方镜像可能被墙了，先换下镜像源，自带梯子的同学可以忽略
# 添加中国镜像源 删除原来的官方镜像源
gem sources --add https://gems.ruby-china.org/ --remove https://rubygems.org/
# 看下是不是切换到中国的镜像源了
gem sources -l

# 安装travis
gem install travis
# 安装完检测一下 有输出代表成功
travis

# 先进入项目目录，然后用github账号密码登录travis
travis login
```

### 5.7 Travis配置SSH免密登录

一般来说，我们开发同学本地已经有一份私钥 `~/.ssh/id_rsa`，没有的话新建一份也很快
```bash
ssh-keygen -t rsa -C "你的邮箱"
# 在询问路径时可以修改文件名，如下图，如果不需要一直回车就可以了，默认名是id_rsa
```

```bash
#登陆成功后用travis加密本地私钥，--add参数会把加密的私钥解密命令插入到.travis.yml，Travis解密时要用到的
travis encrypt-file ~/.ssh/id_rsa_travis --add
# 成功后项目根目录下会多出一个文件 id_rsa.enc
# 然后.travis.yml文件内会被自动插入下面两行内容，是用来自动解密用的
# - openssl aes-256-cbc -K $encrypted_574f1c23860c_key -iv $encrypted_574f1c23860c_iv
# -in id_rsa_travis.enc -out ~/.ssh/id_rsa_travis -d

# 然后添加信任关系  向个人服务器添加公钥
# 添加成功后 所有使用该公钥对应的私钥访问服务器都会直接认证通过
ssh-copy-id -i ~/.ssh/id_rsa_travis.pub [服务器用户]@[服务器IP]
```

![](https://raw.githubusercontent.com/amandakelake/picgo-images/master/images/20200618172233.png)

加密私钥时的输出如上图，要狠认真的读一下
	* 确保 `id_rsa.enc`文件在git仓库中
	* 一定不要把你本机的私钥`~/.ssh/id_rsa`放在git目录里，只有你本机才能有

![](https://raw.githubusercontent.com/amandakelake/picgo-images/master/images/20200618172139.png)

解释一下这两行的意思，首先travis执行任务时会先把我们的代码拉到travis自己的服务器上
	* `-n`  指定待解密的文件，其实就是上面生成的 `id_rsa.enc`文件，travis服务器需要用这个文件来得到我们本机的私钥`id_rsa`
	* `-out` 解密后的私钥存放路径，这个路径指的是travis服务器的目录

这里有个坑，官方工具的bug（不知道同学们现在看的时候修复了没），上面生成的命令的`-out`的值多了一个`\`，酱紫害死小白呀，去掉就正常了
![](https://raw.githubusercontent.com/amandakelake/picgo-images/master/images/20200619124403.png)

另外， travis上面的私钥权限，就算已经加密过了，也不能给其他组的用户读写，得搞个700和600权限（linux的权限设置可以看下这个[Linux 文件权限 · Issue #103 · amandakelake/blog · GitHub](https://github.com/amandakelake/blog/issues/103)），否则travis本身的任务也不能通过
![](https://raw.githubusercontent.com/amandakelake/picgo-images/master/images/20200619124425.png)
所以`before_install`的任务最终长这样
```yaml
before_install:
- openssl aes-256-cbc -K $encrypted_574f1c23860c_key -iv $encrypted_574f1c23860c_iv
-in id_rsa_travis.enc -out ~/.ssh/id_rsa -d
- chmod 700 ~/.ssh/
- chmod 600 ~/.ssh/id_rsa
```

travis的配置暂时告一段落，我们先把后面的构建和PM2部署等流程搞完，再回来添加`after_success`的任务

## 六、使用PM2管理Node应用
PM2的基本使用此处也不多讲了，直接看如何用PM2部署Node应用,参考[PM2 - Deployment](https://pm2.keymetrics.io/docs/usage/deployment/)
```bash
# 全局安装pm2 如果已安装可以直接忽略
yarn global add pm2
# 项目根目录新建 pm2 配置文件
touch ecosystem.config.js
```

先把下面的配置写上，重要的注释都在里面
```js
module.exports = {
    apps: [
        {
            name: 'vue-ssr',
            script: './server/server.js',
            watch: [
                // 监控变化的目录，一旦变化，自动重启
                'src',
                'server',
                'config',
            ],
            ignore_watch: [
                // 忽视这些目录的变化
                'node_modules',
                'dist',
            ],
            error_file: './logs/err.log',
            out_file: './logs/out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
        },
    ],

    deploy: {
        production: {
            // 服务器用户名（我这里偷懒用了root,权限太高了，应该新建一个用户的，别学我）
            user: 'root',
            // 服务器IP地址
            host: '45.32.33.18',
            // 要拉取的git分支
            ref: 'origin/master',
            // git仓库地址
            repo: 'https://github.com/amandakelake/vue-ssr',
            // 拉取到服务器的哪个目录下
            path: '/root/projects/vue-ssr',
			  // 自动将 github 加入远程服务器的信任列表
            ssh_options: 'StrictHostKeyChecking=no',
            'pre-deploy-local': '',
            // 部署前执行
            'pre-deploy': 'git fetch --all',
            // 部署后执行 自动重启
            'post-deploy': 'yarn --ignore-engines && pm2 reload ecosystem.config.js --env production',
            'pre-setup': '',
            env: {
                NODE_ENV: 'production',
            },
        },
    },
};
```

* 以上服务器和目录相关的，请改为你们自己的配置，没有我本地的`id_rsa`，你们是推不上我的服务器的
 * `yarn --ignore-engines`本质上是忽略引擎版本检查，`--ignore-engines`用于修复node版本不兼容的命令配置
![](https://raw.githubusercontent.com/amandakelake/picgo-images/master/images/20200618174948.png)

* `pm2 reload ecosystem.config.js --env production`比较好理解，就是每次travis通知PM2执行更新时，自动重启Node服务

**在首次部署时，我们需要先初始化远程服务器项目**，这一步会在远程服务器创建项目
```bash
# 在本机执行即可，因为本机跟远程服务器之间也有SSH关系
pm2 deploy ecosystem.config.js prod setup
```
![](https://raw.githubusercontent.com/amandakelake/picgo-images/master/images/20200618182924.png)

然后执行部署
```bash
pm2 deploy ecosystem.config.js production
```
![](https://raw.githubusercontent.com/amandakelake/picgo-images/master/images/20200618182955.png)

后面PM2的配置文件`ecosystem.config.js`有更新的话，update即可
```bash
pm2 deploy ecosystem.config.js production update
```

这几步在本机或者travis服务器执行都行，反正都有SSH的免密登录，都是为了让远程个人服务器自动重启Node应用

其实除了setup，后面的两步可以都集成到travis的配置中去，完成一个真正的CD流程，完全不需要手动处理

## 七、 Travis + PM2 持续部署
给`.travis.yml`添加如下配置
```yaml
after_success:
    # StrictHostKeyChecking=no 必传
    # 将前端构建好的静态资源目录 dist 整个复制到远程服务器上
    # -i ~/.ssh/id_rsa 要指定使用哪份私钥 默认的是id_rsa
    - scp -o stricthostkeychecking=no -i ~/.ssh/id_rsa -r ./dist root@45.32.33.18:/root/projects/vue-ssr/source
    # 通知PM2执行更新
    - yarn global add pm2 && pm2 deploy ecosystem.config.js production update
```

注意`/root/projects/vue-ssr/source`后面的`source`是哪来的，这是前面PM2初始化项目的时候，直接在`vue-ssr`目录下创建了一个`source`目录
![](https://raw.githubusercontent.com/amandakelake/picgo-images/master/images/20200619121118.png)

或者直接进线上服务器去看一下目录
![](https://raw.githubusercontent.com/amandakelake/picgo-images/master/images/20200618183418.png)

所以我们要把构建输出目录`/dist`复制到这个`source`目录下，node服务器才能读到正确的路径

所以到目前为止，我们两份核心的配置文件如下

Travis的配置文件`.travis.yml`
```yaml
language: node_js
node_js:
    - stable
branchs:
    only:
        - master
cache:
    directories:
        - node_modules
before_install:
    - openssl aes-256-cbc -K $encrypted_64c70e4da8b9_key -iv $encrypted_64c70e4da8b9_iv
      -in id_rsa.enc -out ~/.ssh/id_rsa -d
    - chmod 700 ~/.ssh/
    - chmod 600 ~/.ssh/id_rsa
install:
    - yarn install
scripts:
    - yarn build
after_success:
    # StrictHostKeyChecking=no 必传
    # 将前端构建好的静态资源目录 dist 整个复制到远程服务器上
    # -i ~/.ssh/id_rsa 要指定使用哪份私钥 默认的是id_rsa
    - scp -o stricthostkeychecking=no -i ~/.ssh/id_rsa -r ./dist root@45.32.33.18:/root/projects/vue-ssr/source
    # 通知PM2执行更新
    - yarn global add pm2@latest && pm2 deploy ecosystem.config.js production update
```

PM2的配置文件`ecosystem.config.js`
```js
module.exports = {
    apps: [
        {
            name: 'ssr',
            script: './server/server.js',
            watch: [
                // 监控变化的目录，一旦变化，自动重启
                'src',
                'server',
                'config',
            ],
            ignore_watch: [
                // 忽视这些目录的变化
                'node_modules',
                'dist',
            ],
            exec_mode: 'cluster_mode',
            error_file: './logs/err.log',
            out_file: './logs/out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            env_production: {
                NODE_ENV: 'production',
            },
        },
    ],

    deploy: {
        production: {
            // 服务器用户名
            user: 'root',
            // 服务器IP地址
            host: '45.32.33.18',
            // 要拉取的git分支
            ref: 'origin/master',
            // git仓库地址
            repo: 'https://github.com/amandakelake/vue-ssr',
            // 拉取到服务器的哪个目录下
            path: '/root/projects/vue-ssr',
            // 自动将 github 加入远程服务器的信任列表
            ssh_options: 'StrictHostKeyChecking=no',
            'pre-deploy-local': '',
            // 部署前执行
            'pre-deploy': 'git fetch --all',
            // 部署后执行 自动重启
            'post-deploy': 'yarn --ignore-engines && pm2 reload ecosystem.config.js --env production',
            'pre-setup': '',
            env: {
                NODE_ENV: 'production',
            },
        },
    },
};
```


## 八、Nginx配置反向代理
这一步其实就是把服务反向代理到Node服务对应的端口去
```bash
# 端口要跟node服务启动的端口一致
upstream {
	server 127.0.0.1:[端口];
}

server {
	# 省略其他配置
	location / {
		proxy_pass http://ssr;
	}
}
```

我这里是直接把服务端渲染应用给打到根目录了，如果想通过二级路径来区分不同应用，比如分配到二级路径`/ssr`下，目前的配置会报404找不到资源，其实就是公共资源的读取路径问题，有兴趣的同学可以自己配
```bash
server {
	# 省略其他配置  以/ssr作为二级路径  暂时会找不到资源
	location /ssr {
		proxy_pass http://ssr;
	}
}
```

以上配置好后，比如我的  [https://luogc.dev/bar](https://luogc.dev/bar)  就可以看到直出的效果了，之后我只需要更新代码推送上github，后面的流程都是自动化完成的
![](https://raw.githubusercontent.com/amandakelake/picgo-images/master/images/20200619122814.png)

## 九、小结
最后，我们再来看下前面的这个图
![](https://raw.githubusercontent.com/amandakelake/picgo-images/master/images/20200618152836.png)

* 1、本地开发代码，推上github
* 2、travis服务器监听到文件变动，拉取最新代码，构建出`/dist`静态资源目录，并复制到个人服务器上指定的项目目录，然后触发PM2的部署任务
* 3、个人服务器上的PM2执行`pre-deploy、post-deploy`等配置的任务，拉取最新代码，安装依赖（这里安装依赖是给Node服务用的，不是用来构建的），然后PM2重启node服务，部署完成

整套流程走下来，其实涉及到前端写代码的内容不多（Vue SSR相关的可以在另一篇额外学习），但涉及到的实操知识却不少：Linux基本操作、Node基础了解、SSH、CI/CD、travis、PM2

我不能保证你对着我的步骤做就一定顺风顺水，而且极有可能在实操过程中踩各种各样的坑，会遇到陌生的领域，不过只要你能坚持查漏补缺，不懂就学，踩坑就查，慢慢总结，最后一定能跑完整个流程，对建立体系化的知识结构有帮助，反正我也是这么而且正在走着这条路，跟同学一起共勉吧，加油。
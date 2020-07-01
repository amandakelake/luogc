module.exports = {
    base: '/blog/',
    title: 'LGC-amandakelake',
    description: 'LGC, amandakelake, blog, Frontend, web, Node, webpack',
    repo: 'https://github.com/amandakelake',
    head: [
        ['link', { rel: 'icon', href: 'https://s3.forcloudcdn.com/dmc/d6d10ad7-0eab-4f24-a458-36178179231e-323x323.png' }]
    ],
    themeConfig: {
        logo: 'https://s3.forcloudcdn.com/dmc/d6d10ad7-0eab-4f24-a458-36178179231e-323x323.png',
        // 添加导航栏
        nav: [
            { text: 'JS基础', link: '/js-basic/this' },
            { text: '框架', link: '/framework/vue' },
            { text: '工程化', link: '/engineering/travis' },
            { text: '学习与思考', link: '/learn/learn-think' },
            { text: '生活', link: '/life/desk' },
            { text: 'Github', link: 'https://github.com/amandakelake'}
        ],
        sidebar: [
            {
                title: 'JavaScript基础',   // 必要的
                // path: '/foo/',      // 可选的, 应该是一个绝对路径
                collapsable: true, // 可选的, 默认值是 true,
                sidebarDepth: 1,    // 可选的, 默认值是 1
                children: [
                    '/',
                    '/js-basic/this',
                    '/js-basic/types',
                ]
            },
            {
                title: '浏览器原理',
                children: ['/browser/browser']
            },
            {
                title: '框架相关',
                children: ['/framework/vue']
            },
            {
                title: '解决方案',
                children: ['/solutions/skeleton']
            },
            {
                title: '工程化',
                children: ['/engineering/travis']
            },
            {
                title: '生活',
                children: ['/life/desk', '/life/software']
            }
        ]
    },
    markdown: {
        lineNumbers: true
    },
};

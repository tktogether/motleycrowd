import Core from './core/index.js'
import { createApp } from 'vue'
import './style/app.scss'
import App from './components/App.vue'

window.onerror = function(msg,source,line,col,error) {
    alert(`${msg}\nat: ${source||"<anonymous>"}:${line}:${col}\n${error}`);
}
window.$ = window.$sys = {};

const core = new Core({
    session: {
        protocol: 'ws',
        // host: "motleycrowdservice.syaro.io",
        host: "test.syaro.io",
        // host: "scarlet-mix",
        port: 1919,
        // handler
    }
});
window.$sys.core = core;
await core.initialize();

const app = createApp(App);
app.mixin({
    props: ['_id'],
    activated() {
        this.$emit('activated', {
            _id: this._id,
            proxy: this,
            callback: data=>this.activated?.(data)
        });
    },
    deactivated() {
        this.$emit('deactivated', {
            _id: this._id,
            proxy: this,
            callback: ()=>this.deactivated?.()
        });
    },
});
const proxy = app.mount('#app');
window.$sys.app = app;
window.$sys.ui = window.$sys.proxy = proxy;

proxy.loading = true;
try {
    await core.start();
    await proxy.start();
} catch(e) {
    proxy.tips('连接服务器失败, 请检查网络连接, 或者过会再试一次');
}
proxy.loading = false;
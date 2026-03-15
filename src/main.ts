import { createApp } from "vue";
import { Quasar, Notify, Dialog } from "quasar";
import "@quasar/extras/material-icons/material-icons.css";
import "quasar/src/css/index.sass";
import App from "./App.vue";
import "./styles/main.css";

const app = createApp(App);

app.use(Quasar, {
    plugins: {
        Notify,
        Dialog,
    },
    config: {
        dark: true,
    },
});

app.mount("#app");

<template>
  <a-config-provider :theme="theme" :locale="zhCN">
    <router-view v-slot="{ Component }">
      <keep-alive>
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </a-config-provider>
</template>

<script setup>
import zhCN from 'ant-design-vue/es/locale/zh_CN'

const theme = {
  token: {
    colorPrimary: '#AD4652',
    colorInfo: '#AD4652',
    colorLink: '#A13E49',
    colorLinkHover: '#BE5964',
    colorBgLayout: '#F7F5F4',
    colorText: '#292527',
    colorBorder: '#E1DAD8',
    controlOutline: 'rgba(173, 70, 82, 0.14)',
    borderRadius: 6,
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
  },
}
</script>

<style>
:root {
  --hib-red: #ad4652;
  --hib-red-dark: #99414b;
  --hib-red-hover: #be5964;
  --hib-red-soft: #fbeef0;
  --hib-gold: #d4ad7b;
  --hib-paper: #f7f5f4;
  --hib-surface: #ffffff;
  --hib-text: #292527;
  --hib-muted: #746d70;
  --hib-line: #e1dad8;
}
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html, body, #app { min-width: 320px; min-height: 100%; background: var(--hib-paper); }
body { color: var(--hib-text); font-family: "Microsoft YaHei", "PingFang SC", sans-serif; }
</style>

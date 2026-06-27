/**
 * @module data/friends
 * @description 友链数据。编辑 friends 数组即可增删友链。
 *              每个条目需提供 name（名称）和 url（链接），
 *              desc（描述）、avatar（头像）、rss 为可选字段。
 */

export interface Friend {
  /** 网站名称 */
  name: string;
  /** 网站链接 */
  url: string;
  /** 网站简介（可选） */
  desc?: string;
  /** 头像图片 URL（可选） */
  avatar?: string;
  /** RSS 订阅地址（可选） */
  rss?: string;
}

/** 友链列表 —— 编辑此处增删友链 */
export const friends: Friend[] = [
  {
    name: "Neomelt's Blog",
    url: "https://neomelt.cloud",
    desc: "Keep looking, don't settle",
    avatar: "https://www.neomelt.cloud/head.jpg",
    rss: "https://www.neomelt.cloud/rss.xml",
  },
];

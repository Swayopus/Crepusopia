---
title: "LaTeX 数学公式测试 — KaTeX 渲染示例"
description: "测试 Astro + KaTeX 的数学公式渲染支持，包括行内公式、块级公式和复杂表达式。"
published: 2026-06-22
updated: 2026-06-24
tags: [math, latex, katex, demo]
category: 工具
pinned: false
draft: false
author: "Merrick Jun Ouyang"
image: "/logo.svg"
---

## 行内公式

质能方程 $E = mc^2$ 可能是物理学最著名的公式。欧拉恒等式 $e^{i\pi} + 1 = 0$ 被称为"最美数学公式"。

勾股定理 $a^2 + b^2 = c^2$ 和求和公式 $\sum_{i=1}^{n} x_i = x_1 + x_2 + \cdots + x_n$ 也是常见示例。

## 块级公式

### 麦克斯韦方程组

$$
\begin{aligned}
\nabla \cdot \mathbf{E} &= \frac{\rho}{\varepsilon_0} \\
\nabla \cdot \mathbf{B} &= 0 \\
\nabla \times \mathbf{E} &= -\frac{\partial \mathbf{B}}{\partial t} \\
\nabla \times \mathbf{B} &= \mu_0\mathbf{J} + \mu_0\varepsilon_0\frac{\partial \mathbf{E}}{\partial t}
\end{aligned}
$$

### 傅里叶变换

$$
\hat{f}(\xi) = \int_{-\infty}^{\infty} f(x)\, e^{-2\pi i x \xi} \,dx
$$

### 贝叶斯定理

$$
P(A|B) = \frac{P(B|A) \cdot P(A)}{P(B)}
$$

## 矩阵

$$
\begin{pmatrix}
a_{11} & a_{12} & \cdots & a_{1n} \\
a_{21} & a_{22} & \cdots & a_{2n} \\
\vdots & \vdots & \ddots & \vdots \\
a_{m1} & a_{m2} & \cdots & a_{mn}
\end{pmatrix}
$$

## 常见公式

**二次方程求根：**

$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$

**柯西-施瓦茨不等式：**

$$
\left|\sum_{i=1}^{n} x_i y_i\right| \leq \sqrt{\sum_{i=1}^{n} x_i^2} \cdot \sqrt{\sum_{i=1}^{n} y_i^2}
$$

**泰勒展开：**

$$
f(x) = \sum_{n=0}^{\infty} \frac{f^{(n)}(a)}{n!}(x-a)^n
$$

## 化学方程式

$$
\ce{2H2 + O2 -> 2H2O}
$$

$$
\ce{CO2 + C -> 2CO}
$$

## 中文混合

对于任意实数 $x$，有不等式 $\frac{x^2 + 1}{2} \geq |x|$，当且仅当 $x = \pm 1$ 时取等号。

---

以上是所有常用数学公式类型的测试。KaTeX 渲染的公式在亮色和暗色模式下都能正确显示。

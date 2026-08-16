# Agent Note: Drop Git-panel recommended gates

Status: implemented

[English](2026-08-17-drop-git-recommended-gates.md) | 中文

## 问题

Git 面板把 typecheck / lint / test / build 列成推荐门禁，创建提交要等这些行通过或跳过。推断出的命令经常失败，或跟暂存集无关，于是拦截变成勾选税：用户得先跑一堆吵的检查，或把失败交给 Agent，才能做一个仍然不会 push 的本地提交。

## 决定

Git 面板不再画推荐门禁，也不再看检查状态。创建提交只要求已暂存文件、非空说明，以及原来的确认勾选。底栏「检查」仍按需发现并跑同一套脚本。

## 考虑过的方案

**只取消拦截、保留清单。** 否决：说明框上方一排失败的四行表还是鸡肋；藏掉运行按钮也只是把面板浪费在没人要看的预览上。

**运行改到底栏检查，Git 面板仍留预览。** 否决：预览是为提交拦截服务的。没有拦截就是第二份检查 UI。

## 后果

Git 面板的本地提交只受确认勾选约束。质量门禁留在检查页和 CI。`recommend-gates.ts` 已删；GitTab 不再接收 Checks store 或 Agent 修复回调。

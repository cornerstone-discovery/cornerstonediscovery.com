---
layout: post
title: '"Brand New" Computer Sale Leads to Inadvertent Corporate Data Breach'
seo_title: Used Computer Sales Can Lead to Corporate Data Breaches
date: 2019-02-08 12:00:00 -0500
author: Kyle McArdle
categories:
- Corporate Law
tags:
- Corporate Data Breach
- Data Breach
image: /uploads/2021/02/christian-wiediger-WkfDrhxDMC8-unsplash-1568x1045-1.jpg
description: You may be excited about new technology, but could it lead to data breaches? While it may seem new on the surface, it could potentially be compromised.
permalink: /brand-new-computer-sale-leads-to-inadvertent-corporate-data-breach/
redirect_from:
- /blog/brand-new-computer-sale-leads-to-inadvertent-corporate-data-breach/
legacy_urls:
- https://www.thetechgazette.com/single-post/2019/02/08/brand-new-computer-leads-to-inadvertent-data-breach
wp_id: 40
---

![](/uploads/2021/01/blue-shirt-typing.webp)

**You lock your building before you leave every night, but how are you safeguarding your digital corporate data?**

Here at Cornerstone Discovery, digital forensics is more than just a job for our team members, it's our *passion*. Which is why when I ordered a too good to be true "open-box" laptop deal this Christmas for my mother, I couldn't help but take a peek under the hood of this "brand new" machine when it reached my desk.

As soon as I opened the box, I knew right away that this laptop was not “brand new,” and turning the computer on quickly confirmed my suspicions.

The laptop booted into a fully configured Windows 10 environment (no password required) under a user account named "Linda." Right away I could see that Linda had Microsoft Access database files sitting on her desktop. Uh-oh… this is the nightmare every IT or SysOp Manager dreads – IP out in the wild, on a completely open and un-encrypted device!

What did I do? Image it, obviously! I loaded up FTK Imager Light from a flash drive and took a physical of the entire SSD before scrubbing it and setting my Mom up with a clean Windows 10 install. For a quick and dirty preview, I kicked off a quick scan using Magnet Forensic's Axiom. Now to see what Linda was working on…

![](/uploads/2021/01/sandisk-drive.webp)

After a quick preview of the discovered artifacts, it looks like Linda really disliked her laptop purchase. She had initially set it up back in June, on the 25th around 1:32 a.m. (if you want to get specific). *I wonder if Linda forgot to change her time-zone from Taiwan, or if she was just a night owl?* She boots her laptop up and configures Windows 10. Once she's up and running, at 1:40 a.m., Linda precedes to plug-in a flash drive (SanDisk Cruzer Dial) containing a ton of MS Access and PDF files. She copies some to her desktop and opens a few others. She unplugs the flash drive about 6 minutes later… and that's about it.

Linda shuts down her computer and presumably returns it. Nothing happens until November when a technician goes in and runs a bunch of diagnostic tools to determine if anything is wrong with the laptop. After that, the step where the hard drive is erased got skipped because not much else happens until December when I plug in my FTK flash drive. Linda got lucky on this one, which is more than I can say for people in real IP theft cases we've investigated.

Linda’s unsecured computer is just one example of where we can identify an inadvertent corporate data breach. In today’s digital landscape, you also need to consider how to keep your data secure from outside threats like hackers, viruses, and hardware failure, as well as employees who exit your organization.

At [Cornerstone Discovery](/digital-forensics/), we're committed to your corporate data security. Contact us to discuss our Security and Compliance Consultation services.

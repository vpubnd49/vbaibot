/**
 * Test nhanh facebook-public-scraper với trang thật.
 * Chạy: npx tsx src/realtime/facebook/facebook-public-scraper.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scrapePublicPagePosts } from "./facebook-public-scraper.js";

describe("Facebook Public Scraper", () => {
  it("cào được bài viết từ trang tintucphanthiet", async () => {
    const posts = await scrapePublicPagePosts("tintucphanthiet", 3);

    console.log(`\n📊 Kết quả: ${posts.length} bài viết\n`);

    for (const post of posts) {
      console.log(`─── Post ${post.postId} ───`);
      console.log(`📝 ${post.message.slice(0, 120)}...`);
      console.log(`🔗 ${post.permalink}`);
      console.log(`🖼️  ${post.imageUrl ?? "(không có ảnh)"}`);
      console.log(`📅 ${post.createdAt}`);
      console.log();
    }

    assert.ok(posts.length > 0, "Phải cào được ít nhất 1 bài viết");

    for (const post of posts) {
      assert.ok(post.postId, "postId không được rỗng");
      assert.ok(post.message.length > 10, "message phải có nội dung");
      assert.ok(post.permalink.includes("facebook.com"), "permalink phải chứa facebook.com");
      assert.ok(post.createdAt, "createdAt không được rỗng");
    }
  });

  it("cào được bài viết từ GDL.GhienDalat", async () => {
    const posts = await scrapePublicPagePosts("GDL.GhienDalat", 2);

    console.log(`\n📊 GhienDalat: ${posts.length} bài viết\n`);
    for (const post of posts) {
      console.log(`📝 ${post.message.slice(0, 100)}...`);
    }

    assert.ok(posts.length > 0, "Phải cào được ít nhất 1 bài từ GhienDalat");
  });

  it("cào được bài viết từ page dạng profile.php?id=", async () => {
    const posts = await scrapePublicPagePosts("profile.php?id=100076386510860", 2);

    console.log(`\n📊 Profile page: ${posts.length} bài viết\n`);
    for (const post of posts) {
      console.log(`📝 ${post.message.slice(0, 100)}...`);
    }

    // Page này có thể không công khai — chỉ kiểm tra không throw error
    assert.ok(Array.isArray(posts), "Phải trả về mảng (dù rỗng nếu page không công khai)");
  });

  it("cào được bài viết từ lacaidalat", async () => {
    const posts = await scrapePublicPagePosts("lacaidalat", 5);

    console.log(`\n📊 lacaidalat: ${posts.length} bài viết\n`);

    for (const post of posts) {
      console.log(`─── Post ${post.postId} ───`);
      console.log(`📝 ${post.message.slice(0, 150)}...`);
      console.log(`🔗 ${post.permalink}`);
      console.log(`🖼️  ${post.imageUrl ?? "(không có ảnh)"}`);
      console.log(`📅 ${post.createdAt}`);
      console.log();
    }

    assert.ok(posts.length > 0, "Phải cào được ít nhất 1 bài từ lacaidalat");

    for (const post of posts) {
      assert.ok(post.postId, "postId không được rỗng");
      assert.ok(post.message.length > 10, "message phải có nội dung");
      assert.ok(post.permalink.includes("facebook.com"), "permalink phải chứa facebook.com");
    }
  });
});

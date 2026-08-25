import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { foldForSearch, isMentioningBot } from "./fold-for-search.js";

describe("foldForSearch", () => {
  it("bỏ dấu để gõ không dấu vẫn tìm được", () => {
    assert.equal(foldForSearch("Châu Phiên Bản Số"), "chau phien ban so");
    assert.equal(foldForSearch("Hồ Chí Minh"), "ho chi minh");
    assert.equal(foldForSearch("Vừa"), "vua");
    assert.equal(foldForSearch("  CAO  "), "cao");
  });

  it("đ/Đ phải thành d - NFD KHÔNG tách được chữ này", () => {
    assert.equal(foldForSearch("Đồng"), "dong");
    assert.equal(foldForSearch("đường"), "duong");
    assert.ok(!foldForSearch("Đà Nẵng").includes("đ"));
  });

  it("chuỗi không dấu giữ nguyên (chỉ hạ chữ thường)", () => {
    assert.equal(foldForSearch("Asia/Ho_Chi_Minh (GMT+07:00)"), "asia/ho_chi_minh (gmt+07:00)");
  });
});

describe("isMentioningBot", () => {
  const label = "Châu Phiên Bản Số";

  it("khớp khi người dùng gõ ANH CHAU, A CHAU, a chau, anh chau (không cần @)", () => {
    assert.ok(isMentioningBot("ANH CHAU", label));
    assert.ok(isMentioningBot("A CHAU", label));
    assert.ok(isMentioningBot("a chau", label));
    assert.ok(isMentioningBot("anh chau", label));
    assert.ok(isMentioningBot("Anh Châu ơi", label));
    assert.ok(isMentioningBot("a chau doc file nay giup em voi", label));
    assert.ok(isMentioningBot("anh chau xem giup", label));
  });

  it("khớp đúng nguyên văn có dấu", () => {
    assert.ok(isMentioningBot("Nhờ @Châu Phiên Bản Số xem giúp", label));
    assert.ok(isMentioningBot("Châu Phiên Bản Số", label));
    assert.ok(isMentioningBot("chau phien ban so", label));
  });

  it("khớp khi người dùng gõ chữ thường không dấu đầy đủ", () => {
    assert.ok(isMentioningBot("anh @chau phien ban so doc file giup em", label));
    assert.ok(isMentioningBot("Anh chau doc file ban linh gui va cho y kien nhe @chau phien ban so", label));
  });

  it("khớp khi người dùng gọi tên ngắn gọn @chau, @Châu, chau oi", () => {
    assert.ok(isMentioningBot("Nhờ @chau đọc file này", label));
    assert.ok(isMentioningBot("Nhờ @Châu đọc file này", label));
    assert.ok(isMentioningBot("Nhờ @CHAU đọc file này", label));
    assert.ok(isMentioningBot("chau oi", label));
    assert.ok(isMentioningBot("chau xem file nay giup", label));
    assert.ok(isMentioningBot("nho chau kiem tra", label));
  });

  it("khớp các tiền tố xưng hô khác như chi chau, c chau, ban chau, em chau", () => {
    assert.ok(isMentioningBot("chi chau xem giup", label));
    assert.ok(isMentioningBot("c chau cho y kien nhe", label));
    assert.ok(isMentioningBot("ban chau oi", label));
  });

  it("khớp khi người dùng gõ dạng viết liền hoặc gạch dưới", () => {
    assert.ok(isMentioningBot("tag @chauphienbanso vao", label));
    assert.ok(isMentioningBot("chauphienbanso xem giup", label));
    assert.ok(isMentioningBot("tag @chau_phien_ban_so vao", label));
  });

  it("khớp @bot có ký tự @", () => {
    assert.ok(isMentioningBot("@bot xem giup em", label));
  });

  it("không nhận nhầm người khác có tên tương tự hoặc tin nhắn thông thường", () => {
    assert.ok(!isMentioningBot("Chào @chautuan anh nhe", label));
    assert.ok(!isMentioningBot("Chào bạn @linh", label));
    assert.ok(!isMentioningBot("chào bot", label));
    assert.ok(!isMentioningBot("Tin nhắn không có tag ai", label));
  });

  it("xử lý an toàn khi text hoặc label rỗng", () => {
    assert.equal(isMentioningBot("", label), false);
    assert.equal(isMentioningBot("hello", ""), false);
  });
});

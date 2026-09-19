async function testEduDetailApi() {
  const url = "https://lamdong.edu.vn/Modules/Sidebar/GetDetailDocument2";
  const params = new URLSearchParams();
  params.append("maCongVan", "0");
  params.append("sodi", "");
  params.append("code", "sgd_document");
  params.append("alias", "");
  params.append("id", "8dc0356c-82a0-4e43-ae67-eb66f401c89e");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest"
    },
    body: params.toString()
  });

  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Raw detail result:\n", text);
}

testEduDetailApi().catch(console.error);

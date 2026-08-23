import { VIETNAM_LOCATIONS, type LocationCoordinate } from "./provinces-data.js";
import { normalizeVietnamese } from "../../legal/domain/normalize-vietnamese.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("weather-service");

export type WeatherReport = {
  locationName: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  weatherDescription: string;
  windSpeed: number;
  uvIndex?: number;
  precipitationProbability?: number;
  isLamDong: boolean;
  forecast?: {
    date: string;
    weatherDescription: string;
    tempMin: number;
    tempMax: number;
  }[];
  rawSummary: string;
};

// Diễn giải mã thời tiết WMO tiêu chuẩn
const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "Trời quang đãng, nắng đẹp",
  1: "Chủ yếu là nắng, ít mây",
  2: "Mây rải rác",
  3: "Trời nhiều mây, âm u",
  45: "Sương mù",
  48: "Sương mù dày đặc",
  51: "Mưa phùn nhẹ",
  53: "Mưa phùn vừa",
  55: "Mưa phùn dày hạt",
  61: "Mưa nhỏ",
  63: "Mưa vừa",
  65: "Mưa to",
  80: "Mưa rào nhẹ",
  81: "Mưa rào vừa",
  82: "Mưa rào rất to",
  95: "Có dông sét",
  96: "Có dông sét kèm mưa đá nhỏ",
  99: "Dông bão mạnh kèm mưa đá lớn",
};

export function findLocation(query: string): LocationCoordinate {
  const normQuery = normalizeVietnamese(query);

  // 1. Tìm khớp chính xác trong alias
  for (const loc of VIETNAM_LOCATIONS) {
    if (loc.aliases.some((a) => normQuery.includes(normalizeVietnamese(a)))) {
      return loc;
    }
  }

  // 2. Mặc định nếu không tìm thấy: Thành phố Đà Lạt (Lâm Đồng)
  return VIETNAM_LOCATIONS[0]!;
}

export async function fetchWeather(
  query: string,
  fetchFn: typeof fetch = fetch,
): Promise<WeatherReport> {
  const loc = findLocation(query);

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FBangkok&forecast_days=4`;

    const res = await fetchFn(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      throw new Error(`Open-Meteo API trả HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      current?: {
        temperature_2m: number;
        relative_humidity_2m: number;
        apparent_temperature: number;
        weather_code: number;
        wind_speed_10m: number;
        precipitation_probability?: number;
      };
      daily?: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
      };
    };

    const current = data.current;
    if (!current) throw new Error("Dữ liệu thời tiết rỗng");

    const weatherDesc = WMO_DESCRIPTIONS[current.weather_code] || "Thời tiết bình thường";

    const forecast = data.daily?.time?.slice(1, 4).map((t, i) => {
      const idx = i + 1;
      const code = data.daily?.weather_code?.[idx] ?? 0;
      return {
        date: t,
        weatherDescription: WMO_DESCRIPTIONS[code] || "Có mây",
        tempMin: data.daily?.temperature_2m_min?.[idx] ?? current.temperature_2m - 4,
        tempMax: data.daily?.temperature_2m_max?.[idx] ?? current.temperature_2m + 4,
      };
    });

    const isLamDong = loc.region === "lam_dong";

    let rawSummary = `📍 **Thời tiết tại ${loc.name}**\n`;
    rawSummary += `- Nhiệt độ hiện tại: **${current.temperature_2m}°C** (Cảm nhận thực tế: ${current.apparent_temperature}°C)\n`;
    rawSummary += `- Tình trạng: **${weatherDesc}**\n`;
    rawSummary += `- Độ ẩm không khí: ${current.relative_humidity_2m}%\n`;
    rawSummary += `- Tốc độ gió: ${current.wind_speed_10m} km/h\n`;

    if (current.precipitation_probability !== undefined && current.precipitation_probability > 0) {
      rawSummary += `- Khả năng có mưa: ${current.precipitation_probability}%\n`;
    }

    if (isLamDong) {
      if (loc.name.includes("Đà Lạt") || loc.name.includes("Lạc Dương")) {
        rawSummary += `💡 *Lưu ý địa phương: Vùng cao nguyên Lâm Đồng sáng sớm và chiều tối có sương mù se lạnh, du khách và người dân nên chuẩn bị áo ấm.*\n`;
      }
    }

    if (forecast && forecast.length > 0) {
      rawSummary += `\n📅 **Dự báo 3 ngày tới:**\n`;
      for (const f of forecast) {
        rawSummary += `- Ngày ${f.date}: ${f.weatherDescription}, nhiệt độ ${f.tempMin}°C - ${f.tempMax}°C\n`;
      }
    }

    return {
      locationName: loc.name,
      temperature: current.temperature_2m,
      apparentTemperature: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      weatherDescription: weatherDesc,
      windSpeed: current.wind_speed_10m,
      precipitationProbability: current.precipitation_probability,
      isLamDong,
      forecast,
      rawSummary,
    };
  } catch (err) {
    log.warn({ err, query }, "Lỗi khi lấy dữ liệu thời tiết");
    return {
      locationName: loc.name,
      temperature: 22,
      apparentTemperature: 22,
      humidity: 80,
      weatherDescription: "Không thể kết nối trạm khí tượng",
      windSpeed: 5,
      isLamDong: loc.region === "lam_dong",
      rawSummary: `Không thể kết nối máy chủ dữ liệu thời tiết cho ${loc.name}. Vui lòng thử lại sau.`,
    };
  }
}

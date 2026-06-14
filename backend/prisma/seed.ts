import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Admin
  const hash = await bcrypt.hash("@Raviliroleta123", 10);
  await prisma.admin.upsert({
    where: { username: "ravili" },
    update: {},
    create: { username: "ravili", password: hash },
  });

  // Máquina padrão
  await prisma.maquina.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "Copa 98",
      price: 2.00,
      cardColor: "#ffb22e",
      bgColor: "#06280a",
      ordem: 0,
      status: "active",
    },
  });

  // Probabilidades (spin normal)
  const probs = [
    { valor: 0,   chance: 55.00 },
    { valor: 0.5, chance: 20.00 },
    { valor: 1,   chance: 12.00 },
    { valor: 2,   chance: 7.00  },
    { valor: 3,   chance: 3.00  },
    { valor: 5,   chance: 2.00  },
    { valor: 10,  chance: 0.70  },
    { valor: 20,  chance: 0.20  },
    { valor: 50,  chance: 0.10  },
  ];
  for (const p of probs) {
    await prisma.probabilidade.upsert({
      where: { id: probs.indexOf(p) + 1 },
      update: {},
      create: { valor: p.valor, chance: p.chance },
    });
  }

  // Probabilidades influencer
  const probsInf = [
    { valor: 0,   chance: 35.00 },
    { valor: 0.5, chance: 25.00 },
    { valor: 1,   chance: 20.00 },
    { valor: 2,   chance: 10.00 },
    { valor: 3,   chance: 5.00  },
    { valor: 5,   chance: 3.00  },
    { valor: 10,  chance: 1.50  },
    { valor: 20,  chance: 0.40  },
    { valor: 50,  chance: 0.10  },
  ];
  for (const p of probsInf) {
    await prisma.probabilidadeInfluencer.upsert({
      where: { id: probsInf.indexOf(p) + 1 },
      update: {},
      create: { valor: p.valor, chance: p.chance },
    });
  }

  // Multiplicadores (val2 — roda bônus)
  const mults = [
    { valor: 1,  chance: 50.00 },
    { valor: 2,  chance: 30.00 },
    { valor: 3,  chance: 15.00 },
    { valor: 5,  chance: 4.50  },
    { valor: 10, chance: 0.50  },
  ];
  for (const m of mults) {
    await prisma.multiplicador.upsert({
      where: { id: mults.indexOf(m) + 1 },
      update: {},
      create: { valor: m.valor, chance: m.chance },
    });
  }

  // Multiplicadores influencer
  const multsInf = [
    { valor: 1,  chance: 40.00 },
    { valor: 2,  chance: 30.00 },
    { valor: 3,  chance: 18.00 },
    { valor: 5,  chance: 9.00  },
    { valor: 10, chance: 3.00  },
  ];
  for (const m of multsInf) {
    await prisma.multiplicadorInfluencer.upsert({
      where: { id: multsInf.indexOf(m) + 1 },
      update: {},
      create: { valor: m.valor, chance: m.chance },
    });
  }

  // Settings padrão
  const settings = [
    { key: "min_deposit",             value: "10"         },
    { key: "min_withdrawal",          value: "20"         },
    { key: "rollover_multiplier",     value: "0"          },
    { key: "max_win_common",          value: "500"        },
    { key: "consolation_enabled",     value: "false"      },
    { key: "consolation_chance",      value: "10"         },
    { key: "active_taxwithdraw",      value: "false"      },
    { key: "value_taxwithdraw",       value: "0"          },
    { key: "auto_withdraw_enabled",   value: "false"      },
    { key: "auto_withdraw_limit",     value: "100"        },
    { key: "auto_withdraw_roles",     value: "both"       },
    { key: "openDeposit",             value: "true"       },
    { key: "garra_site_name",         value: "Copa 98 II" },
    { key: "garra_primary_color",     value: "#ffb22e"    },
    { key: "garra_background_color",  value: "#06280a"    },
    { key: "garra_logo_url",          value: ""           },
    { key: "garra_promo_bar_text",    value: ""           },
    { key: "garra_support_phone",     value: ""           },
    { key: "garra_support_email",     value: ""           },
    { key: "garra_carousel_banners",  value: "[]"         },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({
      where: { settingKey: s.key },
      update: {},
      create: { settingKey: s.key, settingValue: s.value },
    });
  }

  // Gateway padrão
  await prisma.gatewayConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { gatewayName: "simplify", clientId: "", clientSecret: "", isActive: false },
  });

  console.log("Seed concluído! Admin: ravili / @Raviliroleta123");
}

main().catch(console.error).finally(() => prisma.$disconnect());

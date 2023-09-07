import "dotenv/config";
import bot from "@bot-whatsapp/bot";
import { getDay } from "date-fns";
import QRPortalWeb from "@bot-whatsapp/portal";
import BaileysProvider from "@bot-whatsapp/provider/baileys";
import MockAdapter from "@bot-whatsapp/database/mock";

import chatgpt from "./services/openai/chatgpt.js";
import GoogleSheetService from "./services/sheets/index.js";

const googelSheet = new GoogleSheetService(
  "1YickVZ-xgeqKK88pZo9g2wOt40Rd0UOYlIGFEL_pWBE"
);

const GLOBAL_STATE = [];

const flowPrincipal = bot
  .addKeyword(["hola", "hi"])
  .addAnswer([
    `Bienvenidos a mi restaurante de cocina economica automatizado! 🚀`,
    `Tenemos menus diarios variados`,
    `Te gustaria conocerlos ¿?`,
    `Escribe *menu*`,
  ]);

// ... (tu código anterior)

const flowMenu = bot
  .addKeyword("menu")
  .addAnswer(
    `El menu del dia es:`,
    null,
    async (_, { flowDynamic }) => {
      const dayNumber = getDay(new Date());
      const getMenu = await googelSheet.retriveDayMenu(dayNumber);
      for (const menu of getMenu) {
        GLOBAL_STATE.push(menu);
        await flowDynamic(menu);
      }
    }
  )
  .addAnswer(
    `Te interesa alguno?`,
    { capture: true },
    (ctx, { gotoFlow, state }) => {
      const txt = ctx.body;
      // Aquí puedes agregar tu lógica personalizada para determinar si el elemento del menú es lo que el cliente quiere.
      // Por ejemplo, puedes comparar el texto ingresado por el cliente con los elementos del menú en GLOBAL_STATE.
      const menuMatches = GLOBAL_STATE.filter(menuItem =>
        menuItem.toLowerCase().includes(txt.toLowerCase())
      );

      if (menuMatches.length > 0) {
        state.update({ pedido: menuMatches[0] }); // Tomamos el primer elemento que coincide
        return gotoFlow(flowPedido);
      } else {
        return gotoFlow(flowEmpty);
      }
    }
  );

// ... (tu código posterior)


const flowEmpty = bot
  .addKeyword(bot.EVENTS.ACTION)
  .addAnswer("No te he entendido!", null, async (_, { gotoFlow }) => {
    return gotoFlow(flowMenu);
  });

const flowPedido = bot
  .addKeyword(["pedir"], { sensitive: true })
  .addAnswer(
    "¿Cual es tu nombre?",
    { capture: true },
    async (ctx, { state }) => {
      state.update({ name: ctx.body });
    }
  )
  .addAnswer(
    "¿Alguna observacion?",
    { capture: true },
    async (ctx, { state }) => {
      state.update({ observaciones: ctx.body });
    }
  )
  .addAnswer(
    "Perfecto tu pedido estara listo en un aprox 20min",
    null,
    async (ctx, { state }) => {
        const currentState = state.getMyState();
      await googelSheet.saveOrder({
        fecha: new Date().toDateString(),
        telefono: ctx.from,
        pedido: currentState.pedido,
        nombre: currentState.name,
        observaciones: currentState.observaciones,
      });
    }
  );

const main = async () => {
  const adapterDB = new MockAdapter();
  const adapterFlow = bot.createFlow([
    flowPrincipal,
    flowMenu,
    flowPedido,
    flowEmpty,
  ]);
  const adapterProvider = bot.createProvider(BaileysProvider);

  bot.createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  QRPortalWeb();
};

main();
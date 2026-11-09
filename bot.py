import os
from telegram import Update, WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, ContextTypes

TOKEN = os.environ.get("BOT_TOKEN")
WEBAPP_URL = os.environ.get("WEBAPP_URL")  # HTTPS address where static/index.html is hosted

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not WEBAPP_URL:
        await update.message.reply_text(
            "SkyRush is almost ready. Set WEBAPP_URL to the HTTPS address of the game."
        )
        return
    keyboard = [[InlineKeyboardButton(
        "🚀 Открыть SkyRush",
        web_app=WebAppInfo(url=WEBAPP_URL)
    )]]
    await update.message.reply_text(
        "Добро пожаловать в SkyRush!\n"
        "Это развлекательная игра с виртуальными очками без денежных ставок и призов.",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

def main():
    if not TOKEN:
        raise RuntimeError("Set BOT_TOKEN environment variable.")
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.run_polling()

if __name__ == "__main__":
    main()

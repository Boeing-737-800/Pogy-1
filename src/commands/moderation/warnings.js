const Command = require("../../structures/Command");
const discord = require("discord.js");
const moment = require("moment");
const Guild = require("../../database/schemas/Guild.js");
const { MessageEmbed } = require("discord.js");
const warnModel = require("../../database/models/moderation.js");
const ReactionMenu = require("../../data/ReactionMenu.js");

module.exports = class extends Command {
  constructor(...args) {
    super(...args, {
      name: "warns",
      aliases: ["ws", "warnings"],
      description: "Check a certain users warnings",
      category: "Moderation",
      usage: "<user>",
      examples: ["warnings @Peter"],
      guildOnly: true,
      botPermission: ["ADD_REACTIONS"],
    });
  }

  async run(message, args) {
    let client = message.client;

    const guildDB = await Guild.findOne({
      guildId: message.guild.id,
    });
    let language = require(`../../data/language/${guildDB.language}.json`);

    const mentionedMember =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]) ||
      message.member;

    const warnDoc = await warnModel
      .findOne({
        guildID: message.guild.id,
        memberID: mentionedMember.id,
      })
      .catch((err) => console.log(err));

    if (!warnDoc || !warnDoc.warnings.length) {
      return message.channel.sendCustom({
        embeds: [
          new discord.MessageEmbed()
            .setAuthor({
              name: message.author.tag, 
              iconURL: message.author.displayAvatarURL({ dynamic: true }),
            })
            .setDescription(
              `${message.client.emoji.fail} | **${mentionedMember.user.tag}** ${language.warningsNoError}`
            )
            .setTimestamp(message.createdAt)
            .setColor(client.color.red),
        ],
      });
    }

    const data = [];

    for (let i = 0; warnDoc.warnings.length > i; i++) {
      data.push(
        `**Moderator:** ${await message.client.users.fetch(
          warnDoc.moderator[i]
        )}\n**Reason:** ${warnDoc.warnings[i]}\n**Date:** ${moment(
          warnDoc.date[i]
        ).format("dddd, MMMM Do YYYY")}\n**Warning ID:** ${i + 1}\n`
      );
    }

    const count = warnDoc.warnings.length;

    const embed = new MessageEmbed()
      .setAuthor({
        name: mentionedMember.user.tag,
        iconURL: mentionedMember.user.displayAvatarURL({ dynamic: true }),
      })
      .setFooter({
        text: message.member.displayName,
        iconURL: message.author.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp()
      .setColor(client.color.blue);

    const buildEmbed = (current, embed) => {
      const max = count > current + 4 ? current + 4 : count;
      let amount = 0;
      for (let i = current; i < max; i++) {
        if (warnDoc.warnings[i].length > 1000)
          warnDoc.warnings[i] = warnDoc.warnings[i].slice(0, 1000) + "...";
        embed // Build warning list
          .addField(
            "\u200b",
            `**${language.warnName || "unknown"} \`#${i + 1}\`**`
          )
          .addField(
            `${language.warnModerator || "unknown"}`,
            `${message.guild.members.cache.get(warnDoc.moderator[i])}`,
            true
          )

          .addField(
            `${language.warnAction || "unknown"}`,
            `${warnDoc.modType[i]}`,
            true
          ) //it says if its mute or warn or ban etc

          .addField(
            `${language.warnReason || "unknown"}`,
            `${warnDoc.warnings[i]}`,
            true
          )
          .addField(
            `${language.warnID || "unknown"}`,
            `${warnDoc.warningID[i]}`,
            true
          )
          .addField(
            `${language.warnDateIssued || "unknown"}`,
            `${moment(warnDoc.date[i]).format("dddd, MMMM Do YYYY")}`
          );
        amount += 1;
      }

      return embed
        .setTitle(`${language.warnList} [${current} - ${max}]`)
        .setDescription(
          `Showing \`${amount}\` of ${mentionedMember}'s \`${count}\` total warns.`
        );
    };

    if (count < 4) return message.channel.sendCustom(buildEmbed(0, embed));
    else {
      let n = 0;
      const json = embed
        .setFooter({
          text: `${language.warnExpire}\n` + message.member.displayName,
          iconURL: message.author.displayAvatarURL({ dynamic: true }),
        })
        .toJSON();

      const first = () => {
        if (n === 0) return;
        n = 0;
        return buildEmbed(n, new MessageEmbed(json));
      };

      const previous = () => {
        if (n === 0) return;
        n -= 4;
        if (n < 0) n = 0;
        return buildEmbed(n, new MessageEmbed(json));
      };

      const next = () => {
        const cap = count - (count % 4);
        if (n === cap || n + 4 === count) return;
        n += 4;
        if (n >= count) n = cap;
        return buildEmbed(n, new MessageEmbed(json));
      };

      const last = () => {
        const cap = count - (count % 4);
        if (n === cap || n + 4 === count) return;
        n = cap;
        if (n === count) n -= 4;
        return buildEmbed(n, new MessageEmbed(json));
      };

      const reactions = {
        "⏪": first,
        "◀️": previous,
        "⏹️": null,
        "▶️": next,
        "⏩": last,
      };

      const menu = new ReactionMenu(
        message.client,
        message.channel,
        message.member,
        buildEmbed(n, new MessageEmbed(json)),
        null,
        null,
        reactions,
        180000
      );

      menu.reactions["⏹️"] = menu.stop.bind(menu);
    }
  }
};

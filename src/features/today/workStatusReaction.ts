import {
  mascotAnimationForWorkStatus,
  mascotStateForWorkStatus,
  type MascotAnimation,
  type MascotState,
} from "../../assets/mascot";
import type { CurrentWorkStatus } from "../../services/tauri/workStatus";
import type { WorkdayMood } from "./workdayProgress";

const COPY: Record<string, string[]> = {
  working: ["键盘已经热了，脑子还在启动。", "今日份班味加载中，请勿拔电。"],
  focus_brick: ["耳机一戴，世界暂时没有需求。", "正在专注，消息已被精神层面免打扰。"],
  meeting: ["麦克风已开，灵魂未接入。", "点头不代表听懂，只代表摄像头开着。"],
  urgent_insert: ["计划没有变化，只是已经不作数了。", "临时插单：今天的惊喜盲盒。"],
  chased_by_requirements: ["需求说不急，只是希望你十分钟前交。", "你跑快点，需求刚刚又改口了。"],
  slacking: ["正在进行非生产性战略休息。", "鱼没有摸到，班味倒是淡了一点。"],
  gossip: ["耳朵已上线，生产力正在缓冲。", "这不是八卦，是跨部门信息同步。"],
  drinking: ["先续一口命，再回去和工位对线。", "杯子在加班，人类在充电。"],
  lunch: ["当前最高优先级：别让外卖凉。", "干饭期间，需求请排队取号。"],
  nap: ["人已关机，工牌继续值班。", "闭眼五分钟，重启一下午。"],
  daydream: ["脑子已离线，身体保持兼容模式。", "正在发呆，勿扰这点稀缺的空白。"],
  preparing_leave: ["文件正在保存，人已经到电梯口。", "下班不是逃跑，是准时结束服务。"],
  overtime: ["夜色已深，工位还在发光。", "加班没有尽头，只有下一次保存。"],
};

export type WorkStatusReactionState = {
  copy: string;
  mascot: MascotState;
  animation: MascotAnimation;
  memeMark: string;
};

export function getWorkStatusReaction(
  current: CurrentWorkStatus,
  mood: WorkdayMood = "clear",
): WorkStatusReactionState {
  const options = COPY[current.statusType] ?? [current.displayCopy];
  const seed = `${current.statusType}:${current.workDate}:${mood}`;
  const index = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % options.length;
  return {
    copy: options[index] ?? current.displayCopy,
    mascot: mascotStateForWorkStatus(current.statusType),
    animation: mascotAnimationForWorkStatus(current.statusType),
    memeMark: memeMarkForStatus(current.statusType),
  };
}

function memeMarkForStatus(statusType: string): string {
  if (statusType === "chased_by_requirements") return "跑";
  if (statusType === "meeting") return "嗯";
  if (statusType === "slacking") return "鱼";
  if (statusType === "lunch") return "饭";
  if (statusType === "preparing_leave") return "撤";
  if (statusType === "overtime") return "熬";
  return "班";
}

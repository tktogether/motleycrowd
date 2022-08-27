import { IModule } from "../imodule.js";
import SettlementData from "./settlementdata.js";
export default class Game extends IModule {

    #room = '';
    #limit = 0;
    #isInRoom = false;
    #isStarted = false;
    #isPrivate = false;
    #isReady = false;
    #users = new Map();
    #currentQuestion = null;
    #index = -1;
    #currentAnswerSize = 0;
    #lastSettlement = null;

    get room() { return this.#room; }
    get limit() { return this.#limit; }
    get isInRoom() { return this.#isInRoom; }
    get isStarted() { return this.#isStarted; }
    get isPrivate() { return this.#isPrivate; }
    get isReady() { return this.#isReady; }
    get users() { return this.#users; }
    get currentQuestion() { return this.#currentQuestion; }
    get currentAnswerSize() { return this.#currentAnswerSize; }
    get lastSettlement() { return this.#lastSettlement; }

    async initialize() {
        this.$core.proxy('game', {
            user: ([join, leave])=>this.#user(join, leave),
            ready: wait=>this.#ready(wait),
            pending: size=>this.#pending(size),
            question: ([idx, id, picked])=>this.#question(idx, id, picked),
            answer: ([idx, size])=>this.#answer(idx, size),
            settlement: data=>this.#settlement(data),
            resume: data=>this.#resume(data),
        });
        this.#debug();
    }

    async #command(type, data) {
        return this.$core.command(`game.${type}`, data);
    }

    async pair(type) {
        const {success, data} = await this.#command('pair', {type});
        if(success) {
            const {users, limit} = data;
            this.#isInRoom = true;
            this.#isPrivate = false;
            this.#limit = limit;
            this.#join(users);
        }
        return success;
    }

    async create(type) {
        const {success, data} = await this.#command('create', {type});
        if(success) {
            const {room, info: {users, limit}} = data;
            this.#isInRoom = true;
            this.#isPrivate = true;
            this.#room = room;
            this.#limit = limit;
            this.#join(users);
        }
        return success;
    }

    async join(room) {
        const {success, data} = await this.#command('join', {room});
        if(success) {
            const {users, limit} = data;
            this.#isInRoom = true;
            this.#isPrivate = true;
            this.#room = room;
            this.#limit = limit;
            this.#join(users);
        }
        return success;
    }

    async leave() {
        if(!this.#isInRoom) return true;
        const {success} = await this.#command('leave');
        if(success) this.clear();
        return success;
    }

    async answer(answer) {
        if(!this.#currentQuestion) return false;
        const {success} = await this.#command('answer', [
            this.#index, answer
        ]);
        if(success)
            this.#currentQuestion.answer = answer;
        return success;
    }

    #join(users) {
        for(const user of users) {
            const [uuid, guest, username] = user;
            this.#users.set(uuid, {
                uuid, guest, username,
            });
        }
    }

    #leave(uuids) {
        for(const uuid of uuids)
            this.#users.delete(uuid);
    }

    #user(join, leave) {
        this.#join(join);
        this.#leave(leave);
        $.emit('game.user', this.#users);
    }

    #ready() {
        this.#isReady = true;
        $.emit('game.ready');
    }

    #pending() {
        this.#isReady = false;
        $.emit('game.pending');
    }

    #question(idx, id, picked) {
        const question = this.$core.question.get(id, picked);
        this.#index = idx;
        this.#currentQuestion = question;
        this.#currentAnswerSize = 0;
        if(!this.#isStarted) {
            this.#isStarted = true;
            $.emit('game.start');
        }
        $.emit('game.question', question);
    }

    #answer(idx, size) {
        if(idx != this.#index) return;
        this.#currentAnswerSize = size;
        $.emit('game.answer', size);
    }

    #settlement(data) {
        const users = new Map(this.#users);
        const settlement = new SettlementData(
            this.$core.user.uuid,
            this.$core.question.get,
            data,
            users,
        );
        this.#lastSettlement = settlement;
        this.clear();
        $.emit('game.settlement', settlement);
    }

    #resume({info, start, question}) {
        this.#isInRoom = true;
        const {users, limit} = info;
        this.#isPrivate = false;
        this.#limit = limit;
        this.#join(users);
        if(!start)
            return $.emit('game.resume.room');

        const {idx, id, picked, left, size, answer} = question;
        question = this.$core.question.get(id, picked, left, answer);
        this.#currentAnswerSize = size;
        this.#isStarted = true;
        this.#index = idx;
        this.#currentQuestion = question;
        $.emit('game.resume.question', {question, answer});
    }

    clear() {
        this.#room = '';
        this.#limit = 0;
        this.#isInRoom = false;
        this.#isStarted = false;
        this.#isReady = false;
        this.#isPrivate = false;
        this.#currentQuestion = null;
        this.#index = -1;
        this.#currentAnswerSize = 0;
        this.#users.clear();
    }
    #debug() {
        $.on('debug.game.settlement', data=>{
            const settlement = new SettlementData(
                data.users.includes(this.$core.user.uuid)
                    ?this.$core.user.uuid
                    :data.users[0],
                this.$core.question.get,
                data,
                new Map(data.users.map(uuid=>([uuid, {
                    uuid, guest: uuid[0]=="#", username: uuid,
                }]))),
            );
            $.emit('game.settlement', settlement);
        });
    }
}
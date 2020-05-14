import backend
from flask import Flask,url_for, render_template,redirect, request
import flask
import time
import requests
import os,binascii
from psycopg2.extras import execute_values

def verify_login(func):
    def wrapper(**kwargs):
        if 'Authorization' not in request.headers:
            return flask.abort(403)
        if request.headers['Authorization'].split(" ")[0] != "Token":
            return flask.abort(403)
        token = request.headers['Authorization'].split(" ")[1]
        cur = backend.conn.cursor()
        cur.execute("SELECT email from users where token = %s",(token,))
        response = cur.fetchone()
        if response == None:
            return flask.abort(403)
        cur.close()
        return func(*kwargs.values(),response[0])
    wrapper.__name__ = func.__name__
    return wrapper


@backend.app.route('/exercises/<exerciseid>/sessions/', methods = ['GET'])
@verify_login
def get_exercise_sessions(exerciseid,email):
    pass

@backend.app.route('/exercises/<exerciseid>/sessions/', methods = ['POST'])
@verify_login
def add_exercise_sessions(exerciseid,email):
    pass

@backend.app.route('/sessions/<sessionid>/', methods = ['GET'])
@verify_login
def get_session_info(sessionid,email):
    pass

@backend.app.route('/sessions/<sessionid>/', methods = ['DELETE'])
@verify_login
def delete_session(sessionid,email):
    pass

@backend.app.route('/sessions/<sessionid>/stop/', methods = ['PATCH'])
@verify_login
def stop_session(sessionid,email):
    pass

@backend.app.route('/sessions/<sessionid>/start/', methods = ['PATCH'])
@verify_login
def start_session(sessionid,email):
    pass

@backend.app.route('/projects/<projectid>/session/', methods = ['PATCH'])
@verify_login
def update_project_session(projectid,email):
    pass
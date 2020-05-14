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

def find_roles(courseid, role, email):
    cur = backend.conn.cursor()
    cur.execute("SELECT role from users_courses WHERE email=%s AND courseid=%s",(email,courseid))
    course = cur.fetchone()
    
    if course == None:
        cur.execute("SELECT is_admin from users where email = %s",(email,))
        response = cur.fetchone()
        if response == None or response[0] == False:
            cur.close()
            return flask.abort(403)
    elif course[0] == 2:
        cur.close()
        return flask.abort(403)

    cur.execute("select users_courses.email, users.fullname, users.is_admin from users_courses, users where courseid=%s and role=%s and users.email=users_courses.email;",(courseid, role))
    users = cur.fetchall()
    cur.close()
    return flask.jsonify([ {"email":user[0] ,"fullname":user[1], "is_admin":user[2]} for user in users]),200

def remove_roles(courseid, role, email, users):
    cur = backend.conn.cursor()
    cur.execute("SELECT role from users_courses WHERE email=%s AND courseid=%s",(email,courseid))
    course = cur.fetchone()

    if course == None:
        cur.execute("SELECT is_admin from users where email = %s",(email,))
        response = cur.fetchone()
        if response == None or response[0] == False:
            cur.close()
            return flask.abort(403)
    elif course[0] == 2:
        cur.close()
        return flask.abort(403)

    cur.execute("delete from users_courses where courseid=%s and role=%s and email in (%s)",(courseid, role, str(users)[1:-1]))
    backend.conn.commit()
    cur.close()
    return flask.jsonify({}), 204

def add_roles(courseid, role, email, users):
    cur = backend.conn.cursor()
    cur.execute("SELECT role from users_courses WHERE email=%s AND courseid=%s",(email,courseid))
    course = cur.fetchone()
    if course == None:
        cur.execute("SELECT is_admin from users where email = %s",(email,))
        response = cur.fetchone()
        if response == None or response[0] == False:
            cur.close()
            return flask.abort(403)
    elif course[0] == 2:
        cur.close()
        return flask.abort(403)

    added_users =  [(user,) for user in users]
    execute_values(cur,"insert into users (email) VALUES %s ON CONFLICT (email) DO NOTHING",added_users)


    formatted_users =  [(user, courseid,role) for user in users]

    execute_values(cur,"insert into users_courses (email, courseid, role) VALUES %s ON CONFLICT (email,courseid) DO UPDATE SET role={}".format(role),formatted_users)
    backend.conn.commit()
    cur.close()
    return flask.jsonify({}), 204

def get_courses(email, role):
    cur = backend.conn.cursor()
    cur.execute("SELECT courses.courseid, courses.name, courses.semester, courses.year from users_courses, courses WHERE courses.courseid = users_courses.courseid and email=%s and role= %s",(email,role))
    courses = cur.fetchall()
    cur.close()
    return flask.jsonify(courses)

@backend.app.route('/courses/<courseid>/admins/', methods = ['GET'])
@verify_login
def get_course_admins(courseid,email):
    return find_roles(courseid,0,email)

@backend.app.route('/courses/<courseid>/admins/', methods = ['POST'])
@verify_login
def add_course_admins(courseid,email):
    return add_roles(courseid,0,email,request.form["users"])

@backend.app.route('/courses/<courseid>/admins/', methods = ['PATCH'])
@verify_login
def remove_course_admins(courseid,email):
    return remove_roles(courseid,0,email,request.form["users"])

@backend.app.route('/courses/<courseid>/staff/', methods = ['GET'])
@verify_login
def get_course_staff(courseid,email):
    return find_roles(courseid,1,email)

@backend.app.route('/courses/<courseid>/staff/', methods = ['POST'])
@verify_login
def add_course_staff(courseid,email):
    return add_roles(courseid,1,email,request.form["users"])

@backend.app.route('/courses/<courseid>/staff/', methods = ['PATCH'])
@verify_login
def remove_course_staff(courseid,email):
    return remove_roles(courseid,2,email,request.form["users"])

@backend.app.route('/courses/<courseid>/students/', methods = ['GET'])
@verify_login
def get_course_students(courseid,email):
    return find_roles(courseid,2,email)

@backend.app.route('/courses/<courseid>/students/', methods = ['POST'])
@verify_login
def add_course_students(courseid,email):
    return add_roles(courseid,2,email,request.form["users"])

@backend.app.route('/courses/<courseid>/students/', methods = ['PATCH'])
@verify_login
def remove_course_students(courseid,email):
    return remove_roles(courseid,2,email,request.form["users"])

@backend.app.route('/users/<userid>/courses_is_admin_for/', methods = ['GET'])
@verify_login
def get_users_admin_courses(userid,email):
    return get_courses(userid,0)

@backend.app.route('/users/<userid>/courses_is_staff_for/', methods = ['GET'])
@verify_login
def get_users_staff_courses(userid,email):
    return get_courses(userid,1)

@backend.app.route('/users/<userid>/courses_is_student_for/', methods = ['GET'])
@verify_login
def get_users_student_courses(userid,email):
    return get_courses(userid,2)

@backend.app.route('/users/<userid>/', methods = ['GET'])
@verify_login
def get_user_info(userid,email):
    cur = backend.conn.cursor()
    cur.execute("SELECT * from users WHERE email=%s",(userid,))
    user = cur.fetchone()
    cur.close()
    if user == None:
        return flask.jsonify([])
    output = {"email":user[0],"fullname":user[1],"is_admin":user[2]}
    return flask.jsonify(output)

@backend.app.route('/users/whoami/', methods = ['GET'])
@verify_login
def get_logged_in_user(email):
    cur = backend.conn.cursor()
    cur.execute("SELECT * from users WHERE email=%s",(email,))
    user = cur.fetchone()
    cur.close()
    if user == None:
        return flask.jsonify([])
    output = {"email":user[0],"fullname":user[1],"is_admin":user[2]}
    return flask.jsonify(output)
